// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";

import { OpenAI } from "openai";

const MODEL_8B = "llama3-8b-8192";
const MODEL_70B = "llama3-70b-8192";
const API_KEY_SECRET = "OPENAI_API_KEY";

async function getAPIKey(context: vscode.ExtensionContext) {
  return await vscode.window
    .showInputBox({
      password: true,
      placeHolder: "Enter your Groq API key",
      prompt: "Please enter your Groq API key for ask.md",
      value: "",
      validateInput(value) {
        return value.startsWith("sk-") || value.startsWith("gsk_")
          ? null
          : "Invalid API key";
      },
    })
    .then((value) => {
      if (!value) return;
      return context.secrets.store(API_KEY_SECRET, value).then(
        () => {
          return value;
        },
        (error) => {
          vscode.window.showErrorMessage(
            "Failed to save API key for the following reason(s): " + error
          );
        }
      );
    });
}

async function codeComplete(model: string, apiKey: string | undefined) {
  const languageId = vscode.window.activeTextEditor?.document.languageId;

  if (languageId !== "markdown") {
    vscode.window.showErrorMessage("Please open a Markdown file to use ask.md");
  }

  if (!apiKey) {
    vscode.window.showErrorMessage("Please set an API key");
    return;
  }

  const text = vscode.window.activeTextEditor?.document.getText();
  const openai = new OpenAI({
    apiKey,
    baseURL: "https://api.groq.com/openai/v1",
  });
  const completion = await openai.chat.completions.create(
    {
      model,
      temperature: 0.5,
      max_tokens: 1000,
      stream: true,
      messages: [
        {
          role: "system",
          content:
            "You are a knowledgeable and experienced software engineer. Provide explanations and code snippets in various programming languages. Offer suggestions and solutions to coding problems. Be concise and clear in your responses. Avoid using jargon or overly technical terms unless necessary. Focus on helping the user understand the concepts and implementing them in their code.",
        },
        { role: "user", content: text || "" },
      ],
    },
    { stream: true }
  );

  // const completionText = [];
  for await (const chunk of completion) {
    console.log(chunk.choices[0]?.delta.content || "");
    await vscode.window.activeTextEditor?.edit(async (editBuilder) => {
      editBuilder.insert(
        vscode.window.activeTextEditor!.selection.active,
        chunk.choices[0]?.delta.content || ""
      );
    });
  }
}

export async function activate(context: vscode.ExtensionContext) {
  let apiKey = await context.secrets.get(API_KEY_SECRET);
  if (!apiKey) {
    apiKey = await getAPIKey(context);
  }

  const disposables = [
    vscode.commands.registerCommand("ask-md.complete-8b", async () => {
			await codeComplete(MODEL_8B, apiKey);
		}),
    vscode.commands.registerCommand("ask-md.complete-70b", async () => {
			await codeComplete(MODEL_70B, apiKey);
		}),
    vscode.commands.registerCommand("ask-md.set-api-key", () => {
      getAPIKey(context).then((value) => {
        if (value) {
          vscode.window.showInformationMessage("API key saved");
          apiKey = value;
        }
      });
    }),
    vscode.commands.registerCommand("ask-md.delete-api-key", () => {
      if (apiKey) {
        vscode.window
          .showInformationMessage(
            "Are you sure you want to delete your API key?",
            "Delete"
          )
          .then((response) => {
            if (response === "Delete") {
              apiKey = undefined;
              context.secrets.delete(API_KEY_SECRET);
              vscode.window.showInformationMessage("API key deleted");
            }
          });
      } else {
        vscode.window.showInformationMessage("No API key set");
      }
    }),
  ];

  disposables.forEach((disposable) => context.subscriptions.push(disposable));
}
