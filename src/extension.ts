// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";

import { OpenAI } from "openai";

const API_KEY_SECRET = "API_KEY_SECRET";
const API_BASE_URI_SMALL = "api-base-small";
const API_BASE_URI_LARGE = "api-base-large";
const MODEL_SMALL = "model-small";
const MODEL_LARGE = "model-large";
const SETUP_INSTRUCTIONS = "SETUP_INSTRUCTIONS";

const modelIds = {
  "LM Studio (localhost:1234)": [
    "LM Studio Community/aya-23-35B-GGUF",
    "LM Studio Community/aya-23-8B-GGUF",
    "LM Studio Community/Mistral-7B-Instruct-v0.3-GGUF",
    "LM Studio Community/codegemma-1.1-7b-it-GGUF",
    "LM Studio Community/Yi-1.5-9B-Chat-GGUF",
    "LM Studio Community/Yi-1.5-34B-Chat-GGUF",
    "LM Studio Community/Yi-1.5-6B-Chat-GGUF",
    "LM Studio Community/Meta-Llama-3-120B-Instruct-GGUF",
    "LM Studio Community/Llama3-ChatQA-1.5-8B-GGUF",
    "LM Studio Community/Llama3-ChatQA-1.5-70B-GGUF",
    "LM Studio Community/Meta-Llama-3-70B-Instruct-GGUF",
    "LM Studio Community/Meta-Llama-3-8B-Instruct-BPE-fix-GGUF",
    "LM Studio Community/Meta-Llama-3-70B-Instruct-BPE-fix-GGUF",
    "LM Studio Community/Meta-Llama-3-8B-Instruct-GGUF",
    "LM Studio Community/Phi-3-mini-4k-instruct-BPE-fix-GGUF",
    "LM Studio Community/starcoder2-15b-instruct-v0.1-GGUF",
    "LM Studio Community/Phi-3-mini-4k-instruct-GGUF",
    "LM Studio Community/Qwen1.5-32B-Chat-GGUF",
    "LM Studio Community/wavecoder-ultra-6.7b-GGUF",
    "LM Studio Community/WizardLM-2-7B-GGUF",
    "LM Studio Community/c4ai-command-r-v01-GGUF",
    "LM Studio Community/codegemma-2b-GGUF",
    "LM Studio Community/codegemma-7b-GGUF",
    "LM Studio Community/codegemma-7b-it-GGUF",
    "LM Studio Community/gemma-1.1-2b-it-GGUF",
    "LM Studio Community/Starling-LM-7B-beta-GGUF",
    "LM Studio Community/stable-code-instruct-3b-GGUF",
    "LM Studio Community/dolphin-2.8-mistral-7b-v02-GGUF",
    "LM Studio Community/Hyperion-3.0-Mistral-7B-DPO-GGUF",
  ],
  OpenAI: ["gpt-3.5-turbo", "gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"],
  Groq: [
    "llama3-8b-8192",
    "llama3-70b-8192",
    "mixtral-8x7b-32768",
    "gemma-7b-it",
  ],
  Custom: [],
};

async function getAPIKey(context: vscode.ExtensionContext) {
  return await vscode.window
    .showInputBox({
      password: true,
      placeHolder: "Enter your API key",
      prompt: "Please enter your API key for LLM queries (empty if local LLM)",
      value: "",
      validateInput() {
        return null;
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

const defaultProviders = {
  Groq: "https://api.groq.com/openai/v1",
  OpenAI: "https://api.openai.com/v1",
  "LM Studio (localhost:1234)": "http://localhost:1234/v1",
};

function dynamicQuickPick({
  defaultItems,
  newValueQualifier,
  placeholder,
  title,
  defaultValue,
}: {
  defaultItems: string[];
  newValueQualifier: (value: string) => boolean;
  placeholder: string;
  title: string;
  defaultValue?: string;
}) {
  return new Promise((resolve, reject) => {
    const quickPick = vscode.window.createQuickPick();

    const defaultItemsMapped = defaultItems.map((label) => ({
      label,
    }));
    quickPick.items = defaultItemsMapped;
    quickPick.placeholder = placeholder;
    quickPick.ignoreFocusOut = true;
    quickPick.title = title;
    quickPick.onDidChangeValue((value) => {
      if (newValueQualifier(value)) {
        quickPick.items = [...defaultItemsMapped, { label: value }];
      } else {
        quickPick.items = defaultItemsMapped;
      }
    });
    quickPick.value = defaultValue || "";

    quickPick.show();

    let selectedValue: string = defaultValue || "";
    quickPick.onDidChangeActive((value) => {
      selectedValue = value[0].label || "";
    });

    quickPick.onDidAccept(() => {
      if (selectedValue.length === 0) {
        reject("No LLM provider selected");
      } else {
        resolve(selectedValue);
      }
      quickPick.hide();
    });
  }) as Promise<string>;
}

async function getLLMModelID(
  context: vscode.ExtensionContext,
  {
    large,
    small,
    provider,
  }: { large: boolean; small: boolean; provider: keyof typeof modelIds | "All" }
) {
  const configuration = vscode.workspace.getConfiguration(
    "ask-md",
    vscode.window.activeTextEditor?.document.uri
  );
  const modelIdList =
    provider === "All" ? Object.values(modelIds).flat() : modelIds[provider];
  const llmModelID = await dynamicQuickPick({
    defaultItems: modelIdList,
    newValueQualifier: (value) =>
      (value.includes("/") || value.includes("-")) &&
      modelIdList.findIndex((id) => id.includes(value)) === -1,
    placeholder: "Select one of the options below or enter a custom model ID",
    title: `Select an LLM model ID${
      small && large ? "" : ` (${small ? "basic" : "advanced"} model)`
    }`,
    defaultValue: configuration.get<string>(large ? MODEL_LARGE : MODEL_SMALL),
  });

  if (llmModelID) {
    if (large) {
      configuration.update(
        MODEL_LARGE,
        llmModelID,
        vscode.ConfigurationTarget.Global
      );
    }
    if (small) {
      configuration.update(
        MODEL_SMALL,
        llmModelID,
        vscode.ConfigurationTarget.Global
      );
    }
  }

  return llmModelID;
}

function reverseUrlToProvider(url: string) {
  if (url.startsWith("https://api.groq.com")) {
    return "Groq";
  } else if (url.startsWith("https://api.openai.com")) {
    return "OpenAI";
  } else {
    return "LM Studio (localhost:1234)";
  }
}

async function getLLMBaseUri({
  large,
  small,
}: {
  large: boolean;
  small: boolean;
}) {
  const configuration = vscode.workspace.getConfiguration(
    "ask-md",
    vscode.window.activeTextEditor?.document.uri
  );

  const llmProvider = await dynamicQuickPick({
    defaultItems: Object.keys(defaultProviders),
    newValueQualifier: (value) =>
      value.includes(".") ||
      value.includes(":") ||
      value.includes("/") ||
      value.includes("localhost"),
    placeholder: "Select one of the options below or enter a custom base URL",
    title: `Select an LLM provider${
      small && large ? "" : ` (${small ? "basic" : "advanced"} model)`
    }`,
    defaultValue: large
      ? configuration.get<string>(API_BASE_URI_LARGE)
      : configuration.get<string>(API_BASE_URI_SMALL),
  });

  let llmBaseUri = "";
  if (llmProvider in defaultProviders) {
    llmBaseUri = defaultProviders[llmProvider as keyof typeof defaultProviders];
  } else {
    llmBaseUri = llmProvider;
  }

  if (llmBaseUri) {
    if (large) {
      configuration.update(
        API_BASE_URI_LARGE,
        llmBaseUri,
        vscode.ConfigurationTarget.Global
      );
    }
    if (small) {
      configuration.update(
        API_BASE_URI_SMALL,
        llmBaseUri,
        vscode.ConfigurationTarget.Global
      );
    }
  }

  return {
    baseUri: llmBaseUri,
    provider: (llmProvider in defaultProviders
      ? llmProvider
      : reverseUrlToProvider(llmProvider)) as keyof typeof modelIds,
  };
}

async function codeComplete({
  context,
  apiKey,
  logger,
  small,
}: {
  context: vscode.ExtensionContext;
  apiKey: string | undefined;
  logger: vscode.OutputChannel;
  small: boolean;
}) {
  const languageId = vscode.window.activeTextEditor?.document.languageId;
  const configuration = vscode.workspace.getConfiguration(
    "ask-md",
    vscode.window.activeTextEditor?.document.uri
  );

  if (languageId !== "markdown") {
    vscode.window.showErrorMessage("Please open a Markdown file to use ask.md");
  }

  if (!apiKey) {
    apiKey = "placeholder";
  }

  let model = configuration.get<string>(small ? MODEL_SMALL : MODEL_LARGE);
  const baseURL = configuration.get<string>(
    small ? API_BASE_URI_SMALL : API_BASE_URI_LARGE
  );

  if (!model) {
    model = await getLLMModelID(context, {
      large: !small,
      small,
      provider: baseURL ? reverseUrlToProvider(baseURL) : "All",
    });
  }
  if (!model) {
    vscode.window.showErrorMessage("Please select a model");
    return;
  }

  const text = vscode.window.activeTextEditor?.document.getText();
  const openai = new OpenAI({
    apiKey,
    baseURL,
  });
  const completion = await openai.chat.completions.create(
    {
      model,
      temperature: 0.4,
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

  for await (const chunk of completion) {
    logger.appendLine(
      "Streaming in: " + (chunk.choices[0]?.delta.content || "")
    );
    await vscode.window.activeTextEditor?.edit(async (editBuilder) => {
      editBuilder.insert(
        vscode.window.activeTextEditor!.selection.active,
        chunk.choices[0]?.delta.content || ""
      );
    });
  }
}

async function setItUp(context: vscode.ExtensionContext) {
  await getAPIKey(context);
  await getLLMModelID(context, {
    large: false,
    small: true,
    provider: (await getLLMBaseUri({ large: false, small: true })).provider,
  });
  await getLLMModelID(context, {
    large: true,
    small: false,
    provider: (await getLLMBaseUri({ large: true, small: false })).provider,
  });
}

export async function activate(context: vscode.ExtensionContext) {
  let apiKey = await context.secrets.get(API_KEY_SECRET);
  const setupInstructions = await context.secrets.get(SETUP_INSTRUCTIONS);
  if (!setupInstructions) {
    const setupOption = await vscode.window.showInformationMessage(
      "Would you like to set up your model configuration for Ask.md?",
      "Yes",
      "No"
    );
    await context.secrets.store(SETUP_INSTRUCTIONS, "true");
    if (setupOption === "Yes") {
      await setItUp(context);
    }
  }

  const logger = vscode.window.createOutputChannel("Ask.md");

  const disposables = [
    vscode.commands.registerCommand("ask-md.complete-small", async () => {
      await codeComplete({ apiKey, logger, context, small: true });
    }),
    vscode.commands.registerCommand("ask-md.configure-small", async () => {
      await getLLMModelID(context, {
        large: false,
        small: true,
        provider: (await getLLMBaseUri({ large: false, small: true })).provider,
      });
    }),
    vscode.commands.registerCommand("ask-md.complete-large", async () => {
      await codeComplete({ apiKey, logger, context, small: false });
    }),
    vscode.commands.registerCommand("ask-md.configure-large", async () => {
      await getLLMModelID(context, {
        large: true,
        small: false,
        provider: (await getLLMBaseUri({ large: true, small: false })).provider,
      });
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
    }),
    vscode.commands.registerCommand("ask-md.setup", async () => {
      await setItUp(context);
    }),
  ];

  disposables.forEach((disposable) => context.subscriptions.push(disposable));
}
