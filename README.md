# Codex CLI Prompt Capture

Local research tool for inspecting the model requests assembled by Codex CLI.

Requirements: Node.js 20 or newer, npm, and Windows PowerShell 5.1 or PowerShell 7 for the bundled Codex launcher.

## Where is the prompt?

After a capture, the extracted prompt is written to:

**`captures/latest-system-prompt.md`**

That generated file is intentionally ignored by Git. The full redacted request is written to `captures/latest-request.json`.

No captured prompt or request is distributed with this repository.

## Capture the Codex system prompt

Install dependencies, then run Codex through the isolated capture profile:

```powershell
npm install
npm run capture:codex -- exec "Reply with OK"
```

The launcher starts the dummy server, creates an ignored repo-local Codex home from `config/codex-capture.toml`, invokes the repo-local Codex CLI, and stops the server afterward. It does not read or modify your normal `~/.codex` configuration.

Generated output:

- `captures/latest-system-prompt.md` contains `instructions` plus any `system` or `developer` input messages.
- `captures/latest-request.json` contains the complete redacted request for inspecting tools and other request metadata.

To run only the server:

```powershell
npm run capture:server
```

The Codex profile uses the documented custom provider settings in `config/codex-capture.toml`: `base_url`, `wire_api = "responses"`, no OpenAI authentication, and zero retries.

## Privacy and security

- The capture server binds to `127.0.0.1`, accepts only the Responses endpoint, and never forwards requests.
- Credential-like header and JSON field names are redacted before the request is saved.
- Captures, Codex state, environment files, dependencies, and logs are ignored by Git.
- Requests can still contain source code, prompts, file paths, tool definitions, usernames, or other sensitive context in fields that cannot be safely redacted automatically. Review every generated file before sharing it.
- Do not expose the capture server on a public or shared interface. Do not use it with third-party credentials.

## Research and legal notice

This project is intended for personal research, interoperability testing, debugging, and education on systems you own or are authorized to inspect. It is not affiliated with, endorsed by, or sponsored by OpenAI or GitHub. Codex, OpenAI, GitHub, and Copilot are trademarks of their respective owners.

This project was fully vibe-coded with GPT-5.6 (SOL medium, 272k context) in VS Code using GitHub Copilot. This disclosure describes the development process and does not imply review, endorsement, or sponsorship by OpenAI, GitHub, or Microsoft.

Use this project only in compliance with applicable law, contracts, and product terms. Do not use it to bypass access controls or obtain data you are not authorized to access. Model requests and system prompts may contain confidential or copyrighted material. The project does not include captured prompts, and you should not publish or redistribute captured content unless you have the necessary rights and permission.

This notice is informational and is not legal advice. It does not guarantee that a particular use is permitted.

## Limitations

- Extraction reflects the request shape produced by the installed Codex CLI version and may change between releases.
- Name-based redaction is a safety measure, not a complete data-loss-prevention system.
- The dummy endpoint implements only the minimal streamed Responses API result needed to end a capture run.

## License

The capture tooling and project source are available under the [MIT License](LICENSE). This license does not grant rights to captured requests, prompts, model output, trademarks, or third-party services.
