import sys
import os

# Fix Windows console emoji printing crash
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import database

# Add subdirectories to sys.path so we can import their modules
sys.path.append(os.path.abspath("simple-agent"))
sys.path.append(os.path.abspath("advanced-agent"))

# Simple Agent Imports
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from langchain_mcp_adapters.tools import load_mcp_tools
from langgraph.prebuilt import create_react_agent
from langchain_google_genai import ChatGoogleGenerativeAI
from dotenv import load_dotenv

# Advanced Agent Imports
from src.workflow import Workflow

# override=True ensures a fresh .env key always replaces any cached system env var
dotenv_path = os.path.join(os.path.dirname(__file__), "simple-agent", ".env")
load_dotenv(dotenv_path, override=True)
# Also load advanced-agent .env (in case key is placed there)
advanced_dotenv = os.path.join(os.path.dirname(__file__), "advanced-agent", ".env")
load_dotenv(advanced_dotenv, override=True)

# Global state for MCP
mcp_context = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB
    database.init_db()
    
    # Setup MCP client for simple agent
    model = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        temperature=0,
        google_api_key=os.getenv("GEMINI_API_KEY")
    )
    
    server_params = StdioServerParameters(
        command="npx",
        env={
            **os.environ,
            "FIRECRAWL_API_KEY": os.getenv("FIRECRAWL_API_KEY"),
        },
        args=["-y", "firecrawl-mcp"]
    )
    
    # We must keep the context manager open for the lifetime of the app
    # This is slightly tricky with asynccontextmanager. 
    # We will use an asyncio.Task to run the server if needed, or just enter the context manually.
    cm_stdio = stdio_client(server_params)
    read, write = await cm_stdio.__aenter__()
    
    cm_session = ClientSession(read, write)
    session = await cm_session.__aenter__()
    
    await session.initialize()
    tools = await load_mcp_tools(session)
    agent = create_react_agent(model, tools)
    
    mcp_context['cm_stdio'] = cm_stdio
    mcp_context['cm_session'] = cm_session
    mcp_context['agent'] = agent
    
    # Initialize advanced workflow
    mcp_context['advanced_workflow'] = Workflow()
    
    yield
    
    # Teardown
    await mcp_context['cm_session'].__aexit__(None, None, None)
    await mcp_context['cm_stdio'].__aexit__(None, None, None)

app = FastAPI(lifespan=lifespan)

# Serve frontend
frontend_path = os.path.join(os.path.dirname(__file__), "frontend")

@app.get("/")
async def serve_index():
    return FileResponse(os.path.join(frontend_path, "index.html"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SimpleRequest(BaseModel):
    message: str
    history: List[Dict[str, str]] = []
    chat_id: Optional[str] = None

class AdvancedRequest(BaseModel):
    query: str
    chat_id: Optional[str] = None

class LoginRequest(BaseModel):
    username: str

class CreateChatRequest(BaseModel):
    user_id: str
    title: str
    mode: str

@app.post("/api/auth/login")
async def login(req: LoginRequest):
    if not req.username.strip():
        raise HTTPException(status_code=400, detail="Username cannot be empty")
    user_id = database.get_or_create_user(req.username.strip())
    return {"user_id": user_id, "username": req.username.strip()}

@app.post("/api/history/chat")
async def create_chat(req: CreateChatRequest):
    session_id = database.create_chat_session(req.user_id, req.title, req.mode)
    return {"session_id": session_id}

@app.get("/api/history/user/{user_id}")
async def get_user_chats(user_id: str):
    return {"sessions": database.get_user_chat_sessions(user_id)}

@app.get("/api/history/chat/{session_id}")
async def get_chat_history(session_id: str):
    return {"messages": database.get_chat_messages(session_id)}

@app.post("/api/simple")
async def simple_agent(req: SimpleRequest):
    agent = mcp_context['agent']
    
    messages = [
        {
            "role": "system",
            "content": "You are a helpful assistant that can scrape websites, crawl pages, and extract data using Firecrawl tools. Think step by step and use the appropriate tools to help the user."
        }
    ]
    
    # Add history
    for msg in req.history:
        messages.append({"role": msg["role"], "content": msg["content"]})
        
    messages.append({"role": "user", "content": req.message[:175000]})
    
    if req.chat_id:
        database.save_message(req.chat_id, "user", req.message)
    
    
    try:
        agent_response = await agent.ainvoke({"messages": messages})
        raw_content = agent_response["messages"][-1].content
        
        if isinstance(raw_content, list):
            ai_message = " ".join(
                block.get("text", "") if isinstance(block, dict) else str(block)
                for block in raw_content
                if not isinstance(block, dict) or block.get("type") == "text"
            ).strip()
        else:
            ai_message = raw_content
        if req.chat_id:
            database.save_message(req.chat_id, "ai", ai_message)
            
        return {"reply": ai_message}
    except Exception as e:
        error_str = str(e)
        if "429" in error_str and "RESOURCE_EXHAUSTED" in error_str:
            friendly_error = "⚠️ **API Quota Exceeded**\n\nYou've hit the daily rate limit for your Gemini API key.\n\n**To fix this:**\n1. Wait for your quota to reset (usually resets daily).\n2. Or get a new key from [Google AI Studio](https://aistudio.google.com/app/apikey) and update your `.env` file."
            return {"reply": friendly_error}
        if "400" in error_str and ("API_KEY_INVALID" in error_str or "API key expired" in error_str or "INVALID_ARGUMENT" in error_str):
            friendly_error = "🔑 **Invalid API Key**\n\nYour Gemini API key is invalid or expired.\n\n**How to get a working key:**\n1. Go to **[Google AI Studio](https://aistudio.google.com/app/apikey)**\n2. Sign in with your Google account\n3. Click **'Create API key'**\n4. Copy the key — it must start with **`AIza`**\n5. Paste it into `simple-agent/.env` as `GEMINI_API_KEY=AIza...`\n6. Restart the server"
            return {"reply": friendly_error}
        return {"reply": f"Error: {error_str}"}

@app.post("/api/advanced")
async def advanced_agent(req: AdvancedRequest):
    workflow = mcp_context['advanced_workflow']
    
    if req.chat_id:
        database.save_message(req.chat_id, "user", req.query)
    
    try:
        result = workflow.run(req.query)
    except Exception as e:
        error_str = str(e)
        if "429" in error_str and "RESOURCE_EXHAUSTED" in error_str:
            raise HTTPException(status_code=429, detail="⚠️ API Quota Exceeded: You've hit the rate limit or run out of free quota for the Gemini API key provided in your `.env` file. Wait for it to reset or provide a paid key.")
        raise HTTPException(status_code=500, detail=error_str)
    
    # Map the output back to frontend format
    tools = []
    for company in result.companies:
        icon = "🗄️" # Default icon
        if "firebase" in company.name.lower(): icon = "🔥"
        elif "supabase" in company.name.lower(): icon = "🗄️"
        elif "vercel" in company.name.lower(): icon = "▲"
        else: icon = "🚀"
        
        tags = []
        if company.pricing_model: tags.append(company.pricing_model)
        if company.is_open_source: tags.append("Open Source")
        tags.extend(company.tech_stack[:2])
        
        tools.append({
            "icon": icon,
            "name": company.name,
            "tags": tags,
            "desc": company.description if company.description else "No description available"
        })
        
    recommendation = result.analysis if result.analysis else "No recommendation available."
    
    if req.chat_id:
        extra_data = {"tools": tools, "recommendation": recommendation, "query": req.query}
        database.save_message(req.chat_id, "ai", recommendation, message_type="report", extra_data=extra_data)
        
    return {
        "tools": tools,
        "recommendation": recommendation
    }

# Mount static files AFTER API routes so they don't shadow /api/*
app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    import webbrowser
    from threading import Timer
    
    # Automatically open the browser to the correct URL after a short delay
    Timer(1.5, lambda: webbrowser.open_new("http://localhost:8000/")).start()
    
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)
