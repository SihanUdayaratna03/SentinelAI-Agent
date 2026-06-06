import sys
import os

# Fix Windows console emoji printing crash
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

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

load_dotenv(os.path.join(os.path.dirname(__file__), "simple-agent", ".env"))

# Global state for MCP
mcp_context = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
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

class AdvancedRequest(BaseModel):
    query: str

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
            
        return {"reply": ai_message}
    except Exception as e:
        return {"reply": f"Error: {str(e)}"}

@app.post("/api/advanced")
async def advanced_agent(req: AdvancedRequest):
    workflow = mcp_context['advanced_workflow']
    
    result = workflow.run(req.query)
    
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
        
    return {
        "tools": tools,
        "recommendation": result.analysis if result.analysis else "No recommendation available."
    }

# Mount static files AFTER API routes so they don't shadow /api/*
app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)
