import os
import json
import openai
from fastapi import FastAPI
from pydantic import BaseModel
import uvicorn
from dotenv import load_dotenv

# --- 1. CONFIGURATION ---
load_dotenv()
openai.api_base = os.getenv("OPENAI_API_BASE")
openai.api_key = os.getenv("OPENAI_API_KEY")

# Initialize FastAPI app
app = FastAPI()


# --- 2. THE AGENT'S "BRAIN" (PROMPT AND LLM CALL) ---
# This prompt now describes tools that the VS Code extension will execute.
SYSTEM_PROMPT = """
You are an expert AI coding agent. Your goal is to help users with their coding tasks.
You operate in a loop of Thought and Action. Based on the user's request, you will reason about the task and then choose an action to take. The actions will be executed by the editor.

**AVAILABLE TOOLS:**
- `write_file(filepath: str, content: str)`: Writes content to a file in the user's current project workspace.
- `run_shell_command(command: str)`: Executes a shell command in a terminal within the user's editor.
- `finish(response: str)`: Use this action when the task is complete to respond to the user.

**RESPONSE FORMAT:**
You MUST respond in the following JSON format. Do not write any other text.

{"thought": "Your reasoning and plan for the next step.", "action": {"tool_name": "tool_to_use", "parameters": {"param1": "value1"}}}

**EXAMPLE:**
User Request: "Create a python script that prints 'hello world'."

{"thought": "I need to create a Python file. I'll name it `main.py` and write the print statement into it.", "action": {"tool_name": "write_file", "parameters": {"filepath": "main.py", "content": "print('hello world')"}}}
"""

def query_llm(history: list) -> dict:
    """Sends the conversation history to your local LLM to get the next action."""
    try:
        response = openai.ChatCompletion.create(
            model="Qwen/Qwen2.5-VL-7B-Instruct",
            messages=history,
            temperature=0.0,
            stream=False
        )
        content = response['choices'][0]['message']['content']
        # The LLM's response is expected to be a valid JSON string
        return json.loads(content)
    except json.JSONDecodeError:
        # Handle cases where the LLM's output is not valid JSON
        return {"thought": "Error: Model did not return valid JSON.", "action": {"tool_name": "finish", "parameters": {"response": "I apologize, but I had a formatting error. Please try again."}}}
    except Exception as e:
        print(f"Error calling LLM: {e}")
        return {"thought": f"An error occurred: {e}", "action": {"tool_name": "finish", "parameters": {"response": f"An error occurred while contacting the AI model: {e}"}}}


# --- 3. MODIFIED API ENDPOINT ---
# This Pydantic model defines the structure of the incoming request body
class AgentRequest(BaseModel):
    history: list

@app.post("/agent/decide")
async def decide_next_action(req: AgentRequest):
    """
    This endpoint takes the entire conversation history and returns the LLM's
    next chosen action, without executing it.
    """
    print(f"\n--- Received History for Decision ---")
    # Pretty-print the last few turns for easier debugging
    for message in req.history[-4:]:
        print(message)
        
    llm_decision = query_llm(req.history)
    
    print(f"--- LLM Decision ---")
    print(llm_decision)
    
    # Return the decision directly to the VS Code extension
    return llm_decision


# --- 4. RUN THE SERVER ---
if __name__ == "__main__":
    print("Starting Agent DECISION server on http://0.0.0.0:8001")
    uvicorn.run(app, host="0.0.0.0", port=8001)