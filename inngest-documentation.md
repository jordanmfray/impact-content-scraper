# Inngest Agent Kit Documentation

Visit [agentkit.inngest.com/reference](https://agentkit.inngest.com/reference/) for more details.

## Agents

> **Reference:** [agentkit.inngest.com/concepts/agents](https://agentkit.inngest.com/concepts/agents)

Agents are the core of AgentKit. Agents are stateless entities with a defined goal and an optional set of Tools that can be used to accomplish a goal.
Agents can be called individually or, more powerfully, composed into a Network with multiple agents that can work together with persisted State.
At the most basic level, an Agent is a wrapper around a specific provider’s model, OpenAI gpt-4 for example, and a set of of tools.

**Agents are defined using the createAgent function.**

```js
import { createAgent, agenticOpenai as openai } from '@inngest/agent-kit';

const agent = createAgent({
  name: 'Code writer',
  system:
    'You are an expert TypeScript programmer.  Given a set of asks, you think step-by-step to plan clean, ' +
    'idiomatic TypeScript code, with comments and tests as necessary.' +
    'Do not respond with anything else other than the following XML tags:' +
    '- If you would like to write code, add all code within the following tags (replace $filename and $contents appropriately):' +
    "  <file name='$filename.ts'>$contents</file>",
  model: openai('gpt-4o-mini'),
});
```

### How Agents Work

Agents themselves are relatively simple. When you call run(), there are several steps that happen:
1. **Preparing the prompts**: The initial messages are created using the system prompt, the run() user prompt, and Network State, if the agent is part of a Network.
For added control, you can dynamically modify the Agent’s prompts before the next step using the onStart lifecycle hook.
2. **Inference call**: An inference call is made to the provided model using Inngest’s step.ai. step.ai automatically retries on failure and caches the result for durability.
The result is parsed into an InferenceResult object that contains all messages, tool calls and the raw API response from the model.
To modify the result prior to calling tools, use the optional onResponse lifecycle hook.
3. **Tool calling**: If the model decides to call one of the available tools, the Tool is automatically called.
After tool calling is complete, the onFinish lifecycle hook is called with the updated InferenceResult. This enables you to modify or inspect the output of the called tools.
4. **Complete**: The result is returned to the caller.

### System prompts
An Agent’s system prompt can be defined as a string or an async callback. When Agents are part of a Network, the Network State is passed as an argument to create dynamic prompts, or instructions, based on history or the outputs of other Agents.
​
### Dynamic system prompts
Dynamic system prompts are very useful in agentic workflows, when multiple models are called in a loop, prompts can be adjusted based on network state from other call outputs.

```js
const agent = createAgent({
  name: 'Code writer',
  description:
    'An expert TypeScript programmer which can write and debug code.',

  // The system prompt can be dynamically created at runtime using Network state:
  system: async ({ network }) => {
    // A default base prompt to build from:
    const basePrompt =
      'You are an expert TypeScript programmer. ' +
      'Given a set of asks, think step-by-step to plan clean, ' +
      'idiomatic TypeScript code, with comments and tests as necessary.';

    // Inspect the Network state, checking for existing code saved as files:
    const files: Record<string, string> | undefined = network.state.data.files;
    if (!files) {
      return basePrompt;
    }

    // Add the files from Network state as additional context automatically
    let additionalContext = 'The following code already exists:';
    for (const [name, content] of Object.entries(files)) {
      additionalContext += `<file name='${name}'>${content}</file>`;
    }
    return `${basePrompt} ${additionalContext}`;
  },
});
```

### Static system prompts

Agents may also just have static system prompts which are more useful for simpler use cases.

```js
const codeWriterAgent = createAgent({
  name: 'Copy editor',
  system:
    `You are an expert copy editor. Given a draft article, you provide ` +
    `actionable improvements for spelling, grammar, punctuation, and formatting.`,
  model: openai('gpt-3.5-turbo'),
});
```

### Using Agents in Networks

Agents are the most powerful when combined into Networks. Networks include state and routers to create stateful workflows that can enable Agents to work together to accomplish larger goals.

### Agent descriptions
Similar to how Tools have a description that enables an LLM to decide when to call it, Agents also have an description parameter. This is required when using Agents within Networks. Here is an example of an Agent with a description:

```js
const codeWriterAgent = createAgent({
  name: 'Code writer',
  description:
    'An expert TypeScript programmer which can write and debug code. Call this when custom code is required to complete a task.',
  system: `...`,
  model: openai('gpt-3.5-turbo'),
});
```

---

## Tools

> **Reference:** [agentkit.inngest.com/concepts/tools](https://agentkit.inngest.com/concepts/tools)

Tools are functions that extend the capabilities of an Agent. Along with the prompt (see run()), Tools are included in calls to the language model through features like OpenAI’s “function calling” or Claude’s “tool use.”

**Tools are defined using the createTool function.**

```js
import { createTool } from '@inngest/agent-kit';

const tool = createTool({
  name: 'write-file',
  description: 'Write a file to disk with the given contents',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The path to write the file to',
      },
      contents: {
        type: 'string',
        description: 'The contents to write to the file',
      },
    },
    required: ['path', 'contents'],
  },
  handler: async ({ path, contents }, { agent, network }) => {
    await fs.writeFile(path, contents);
    return { success: true };
  },
});
```

### How to use Tools

Each Tool’s name, description, and parameters are part of the function definition that is used by model to learn about the tool’s capabilities and decide when it should be called. The handler is the function that is executed by the Agent if the model decides that a particular Tool should be called.
Here is a simple tool that lists charges for a given user’s account between a date range:

```js
import { createTool } from '@inngest/agent-kit';

const listChargesTool = createTool({
  name: 'list_charges',
  description:
    "Returns all of a user's charges. Call this whenever you need to find one or more charges between a date range.",
  parameters: z.object({
    userId: z.string(),
    created: z.object({
      gte: z.string().date(),
      lte: z.string().date(),
    }),
  }),
  handler: async ({ userId, created }, { network, agent, step }) => {
    // input is strongly typed to match the parameter type.
    return [{...}]
  },
});
```

**Optional parameters**
Optional parameters should be defined using .nullable() (not .optional()):

```js
const listChargesTool = createTool({
  name: 'list_charges',
  description:
    "Returns all of a user's charges. Call this whenever you need to find one or more charges between a date range.",
  parameters: z.object({
    userId: z.string(),
    created: z.object({
      gte: z.string().date(),
      lte: z.string().date(),
    }).nullable(), // .nullable or .optional
  }),
  handler: async ({ userId, created }, { network, agent, step }) => {
    // input is strongly typed to match the parameter type.
    return [{...}]
  },
});
```

---

## Networks

> **Reference:** [agentkit.inngest.com/concepts/networks](https://agentkit.inngest.com/concepts/networks)

Networks are Systems of Agents. Use Networks to create powerful AI workflows by combining multiple Agents.
A network contains three components:
- The Agents that the network can use to achieve a goal
- A State including past messages and a key value store, shared between Agents and the Router
- A Router, which chooses whether to stop or select the next agent to run in the loop

Here’s a simple example:

```js
import { createNetwork, openai } from '@inngest/agent-kit';

// searchAgent and summaryAgent definitions...

// Create a network with two agents.
const network = createNetwork({
  agents: [searchAgent, summaryAgent],
});

// Run the network with a user prompt
await network.run('What happened in the 2024 Super Bowl?');
```

By calling `run()`, the network runs a core loop to call one or more agents to find a suitable answer.

Networks are defined using the createNetwork function.

```js
import { createNetwork, openai } from '@inngest/agent-kit';

// Create a network with two agents
const network = createNetwork({
  agents: [searchAgent, summaryAgent],
  defaultModel: openai({ model: 'gpt-4o', step }),
  maxIter: 10,
});
```

### How Networks Work

Networks can be thought of as while loops with memory (State) that call Agents and Tools until the Router determines that there is no more work to be done.
1. **Create the Network of Agents**: You create a network with a list of available Agents. Each Agent can use a different model and inference provider.
2. **Provide the staring prompt**: You give the network a user prompt by calling run().
3. **Core execution loop**: The network runs its core loop:
  1. **Call the Network router**: The Router decides the first Agent to run with your input.
  2. **Run the Agent**: Call the Agent with your input. This also runs the agent’s lifecycles, and any Tools that the model decides to call.
  3. **Store the result**: Stores the result in the network’s State. State can be accessed by the Router or other Agent’s Tools in future loops.
  4. **Call the the Router again**: Return to the top of the loop and calls the Router with the new State. The Router can decide to quit or run another Agent.

---

## State

> **Reference:** [agentkit.inngest.com/concepts/state](https://agentkit.inngest.com/concepts/state)

The `State` class provides a way to manage state and history across a network of agents. It includes key-value storage and maintains a stack of all agent interactions. The `State` is accessible to all Agents, Tools and Routers as a `state` or `network.state` property. The `State` class provides typed data accesible via the `data` property.

```js
import { createState } from '@inngest/agent-kit';

export interface NetworkState {
  // username is undefined until extracted and set by a tool
  username?: string;
}

const state = createState<NetworkState>({
  username: 'bar',
});

console.log(state.data.username); // 'bar'


const network = createNetwork({
  // ...
});

// Pass in state to each run
network.run("<query>", { state })
```

### How State is Used

> Shared memory, history, and key-value state for Agents and Networks.

State is shared memory, or context, that is be passed between different Agents in a Networks. State is used to store message history and build up structured data from tools.
State enables agent workflows to execute in a loop and contextually make decisions. Agents continuously build upon and leverage this context to complete complex tasks.

AgentKit's State stores data in two ways:

- **History of messages** - A list of prompts, responses, and tool calls.
- **Fully typed state data** - Typed state that allows you to build up structured data from agent calls, then implement deterministic state-based routing to easily model complex agent workflows.

Both history and state data are used automatically by the Network to store and provide context to the next Agent.

#### History
The history system maintains a chronological record of all Agent interactions in your Network.
Each interaction is stored as an InferenceResult. Refer to the InferenceResult reference for more information.
#### Typed state
State contains typed data that can be used to store information between Agent calls, update agent prompts, and manage routing. Networks, agents, and tools use this type in order to set data:

Common uses for data include:
- Storing intermediate results that other Agents might need within lifecycles
- Storing user preferences or context
- Passing data between Tools and Agents

#### State based routing
The State’s data is only retained for a single Network’s run. This means that it is only short-term memory and is not persisted across different Network run() calls.
You can implement memory by inspecting a network’s state after it has finished running.
State, which is required by Networks, has many uses across various AgentKit components.

### Using state in tools
State can be leveraged in a Tool’s handler method to get or set data. Here is an example of a Tool that uses kv as a temporary store for files and their contents that are being written by the Agent.

```js
const writeFiles = createTool({
  name: "write_files",
  description: "Write code with the given filenames",
  parameters: z.object({
    files: z.array(
      z.object({
        filename: z.string(),
        content: z.string(),
      })
    ),
  }),
  handler: (output, { network }) => {
    // files is the output from the model's response in the format above.
    // Here, we store OpenAI's generated files in the response.
    const files = network.state.data.files || {};
    for (const file of output.files) {
      files[file.filename] = file.content;
    }
    network.state.data.files = files;
  },
});
```

---

## Routers

> **Reference:** [agentkit.inngest.com/concepts/routers](https://agentkit.inngest.com/concepts/routers)

The defaultRouter option in createNetwork defines how agents are coordinated within a Network. It can be either a Function Router or a Routing Agent.

### Function Router

A function router is provided to the defaultRouter option in createNetwork.

```js
const network = createNetwork({
  agents: [classifier, writer],
  router: ({ lastResult, callCount, network, stack, input }) => {
    // First call: use the classifier
    if (callCount === 0) {
      return classifier;
    }

    // Get the last message from the output
    const lastMessage = lastResult?.output[lastResult?.output.length - 1];
    const content =
      lastMessage?.type === "text" ? (lastMessage?.content as string) : "";

    // Second call: if it's a question, use the writer
    if (callCount === 1 && content.includes("question")) {
      return writer;
    }

    // Otherwise, we're done!
    return undefined;
  },
});
```

### createRoutingAgent()

Creates a new routing agent that can be used as a defaultRouter in a network.

```js
import { createRoutingAgent, createNetwork } from "@inngest/agent-kit";

const routingAgent = createRoutingAgent({
  name: "Custom routing agent",
  description: "Selects agents based on the current state and request",
  lifecycle: {
    onRoute: ({ result, network }) => {
      // Get the agent names from the result
      const agentNames = result.output
        .filter((m) => m.type === "text")
        .map((m) => m.content as string);

      // Validate that the agents exist
      return agentNames.filter((name) => network.agents.has(name));
    },
  },
});

// classifier and writer Agents definition...

const network = createNetwork({
  agents: [classifier, writer],
  router: routingAgent,
});
```

### Autonomous Routing

Without a defaultRouter defined, the network will use the "Default Routing Agent" to decide which agent to call next. The "Default Routing Agent" is a Routing Agent provided by Agent Kit to handle the default routing logic.

You can create your own Routing Agent by using the createRoutingAgent helper function:

```js
import { createRoutingAgent } from "@inngest/agent-kit";

const routingAgent = createRoutingAgent({
  name: "Custom routing agent",
  description: "Selects agents based on the current state and request",
  lifecycle: {
    onRoute: ({ result, network }) => {
      // custom logic...
    },
  },
});

// classifier and writer Agents definition...

const network = createNetwork({
  agents: [classifier, writer],
  router: routingAgent,
});
```

### Using state in Routing
The router is the brain of your network - it decides which agent to call next. You can use state to make smart routing decisions:

```js
import { createNetwork } from '@inngest/agent-kit';

// mathAgent and contextAgent Agents definition...

const network = createNetwork({
  agents: [mathAgent, contextAgent],
  router: ({ network, lastResult }): Agent | undefined => {
    // Check if we've solved the problem
    const solution = network.state.data.solution;
    if (solution) {
      // We're done - return undefined to stop the network
      return undefined;
    }

    // retrieve the last message from the output
    const lastMessage = lastResult?.output[lastResult?.output.length - 1];
    const content = lastMessage?.type === 'text' ? lastMessage?.content as string : '';

    // Check the last result to decide what to do next
    if (content.includes('need more context')) {
      return contextAgent;
    }

    return mathAgent;
  };
});
```

---

## Models

### OpenAI Model

> Configure OpenAI as your model provider

The openai function configures OpenAI as your model provider.

```js
import { createAgent, openai } from "@inngest/agent-kit";

const agent = createAgent({
  name: "Code writer",
  system: "You are an expert TypeScript programmer.",
  model: openai({ model: "gpt-4" }),
});
```

### Available Models

```
"gpt-4o"
"chatgpt-4o-latest"
"gpt-4o-mini"
"gpt-4"
"o1-preview"
"o1-mini"
"gpt-3.5-turbo"
```

---

# Full Example

```js
import {
  anthropic,
  createAgent,
  createNetwork,
  createRoutingAgent,
  createTool,
} from "@inngest/agent-kit";
import { z } from "zod";

import { isLastMessageOfType, lastResult } from "./utils.js";

import { knowledgeBaseDB, releaseNotesDB, ticketsDB } from "./databases.js";

// Create shared tools
const searchKnowledgeBase = createTool({
  name: "search_knowledge_base",
  description: "Search the knowledge base for relevant articles",
  parameters: z.object({
    query: z.string().describe("The search query"),
  }),
  handler: async ({ query }, { step }) => {
    return await step?.run("search_knowledge_base", async () => {
      // Simulate knowledge base search
      const results = knowledgeBaseDB.filter(
        (article) =>
          article.title.toLowerCase().includes(query.toLowerCase()) ||
          article.content.toLowerCase().includes(query.toLowerCase())
      );
      return results;
    });
  },
});

const searchLatestReleaseNotes = createTool({
  name: "search_latest_release_notes",
  description: "Search the latest release notes for relevant articles",
  parameters: z.object({
    query: z.string().describe("The search query"),
  }),
  handler: async ({ query }, { step }) => {
    return await step?.run("search_latest_release_notes", async () => {
      // Simulate knowledge base search
      const results = releaseNotesDB.filter(
        (releaseNote) =>
          releaseNote.title.toLowerCase().includes(query.toLowerCase()) ||
          releaseNote.content.toLowerCase().includes(query.toLowerCase())
      );
      return results;
    });
  },
});

const getTicketDetails = async (ticketId: string) => {
  const ticket = ticketsDB.find((t) => t.id === ticketId);
  return ticket || { error: "Ticket not found" };
};

// Create our agents
const customerSupportAgent = createAgent({
  name: "Customer Support",
  description:
    "I am a customer support agent that helps customers with their inquiries.",
  system: `You are a helpful customer support agent.
Your goal is to assist customers with their questions and concerns.
Be professional, courteous, and thorough in your responses.`,
  model: anthropic({
    model: "claude-3-5-haiku-latest",
    defaultParameters: {
      max_tokens: 1000,
    },
  }),
  tools: [
    searchKnowledgeBase,
    createTool({
      name: "update_ticket",
      description: "Update a ticket with a note",
      parameters: z.object({
        ticketId: z.string().describe("The ID of the ticket to update"),
        priority: z.string().describe("The priority of the ticket"),
        status: z.string().describe("The status of the ticket"),
        note: z.string().describe("A note to update the ticket with"),
      }),
      handler: async ({ ticketId, priority, status, note }, { step }) => {
        return await step?.run("update_ticket", async () => {
          // TODO: Update the ticket in the database
          return { message: "Ticket updated successfully" };
        });
      },
    }),
  ],
});

const technicalSupportAgent = createAgent({
  name: "Technical Support",
  description: "I am a technical support agent that helps critical tickets.",
  system: `You are a technical support specialist.
Your goal is to help resolve critical tickets.
Use your expertise to diagnose problems and suggest solutions.`,
  model: anthropic({
    model: "claude-3-5-haiku-latest",
    defaultParameters: {
      max_tokens: 1000,
    },
  }),
  tools: [searchLatestReleaseNotes],
});

// Create our Routing Agent that will orchestrate the network of agents
//  and evaluate if the support request is answered.
const supervisorRoutingAgent = createRoutingAgent({
  name: "Supervisor",
  description: "I am a Support supervisor.",
  system: `You are a supervisor.
Your goal is to answer customer initial request or escalate the ticket if no answer can be provided.
Choose to route tickets to the appropriate agent using the following instructions:
- Critical tickets should be routed to the "Technical Support" agent.
- Actions such as updating the ticket or handling non-critical tickets should be routed to the "Customer Support" agent.

Think step by step and reason through your decision.
When an agent as answered the ticket initial request or updated the ticket, call the "done" tool.`,
  model: anthropic({
    model: "claude-3-5-haiku-latest",
    defaultParameters: {
      max_tokens: 1000,
    },
  }),
  tools: [
    createTool({
      name: "done",
      description: "Call this when the ticket is solved or escalated",
      handler: async () => {},
    }),
    createTool({
      name: "route_to_agent",
      description: "Route the ticket to the appropriate agent",
      parameters: z.object({
        agent: z.string().describe("The agent to route the ticket to"),
      }),
      handler: async ({ agent }) => {
        return agent;
      },
    }),
  ],
  lifecycle: {
    onRoute: ({ result, network }) => {
      const lastMessage = lastResult(network?.state.results);

      // ensure to loop back to the last executing agent if a tool has been called
      if (lastMessage && isLastMessageOfType(lastMessage, "tool_call")) {
        return [lastMessage?.agent.name];
      }

      const tool = result.toolCalls[0];
      if (!tool) {
        return;
      }
      const toolName = tool.tool.name;
      if (toolName === "done") {
        return;
      } else if (toolName === "route_to_agent") {
        if (
          typeof tool.content === "object" &&
          tool.content !== null &&
          "data" in tool.content &&
          typeof tool.content.data === "string"
        ) {
          return [tool.content.data];
        }
      }
      return;
    },
  },
});

// Create a network with the agents with the routing agent
const supportNetwork = createNetwork({
  name: "Support Network",
  agents: [customerSupportAgent, technicalSupportAgent],
  defaultModel: anthropic({
    model: "claude-3-5-haiku-latest",
    defaultParameters: {
      max_tokens: 1000,
    },
  }),
  router: supervisorRoutingAgent,
});
```