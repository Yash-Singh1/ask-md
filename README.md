# Ask.md

This is a quick implementation of how Yacine described Ask.md in his [stream](https://twitter.com/yacineMTB/status/1788633837108408815). This extensino interfaces with OpenAI-compatible servers (Groq, OpenAI, LM Studio, etc.) and allows you to send prompts to the LLM and receive responses in your editor.

## Usage

- Build the VSIX file using `npm run package`.
- Install the VSIX file using the Extensions view in VS Code.
- Setup your basic and advanced model configuration by following the instructions in the popup or using the `Ask.md: Setup model configuration` command.
- Configure keyboard shortcuts for the `Ask.md: LLM Basic Completion Request` and `Ask.md: LLM Advanced Completion Request` commands.
- Open a Markdown file and start typing.
- Enter your prompt and press the configured keyboard shortcut to send the request to the LLM (alternatively, you can use the commands by opening the Command Palette, and searching for `Ask.md`).
