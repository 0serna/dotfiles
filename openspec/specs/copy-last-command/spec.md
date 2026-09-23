# copy-last-command Specification

## Purpose

Lets users copy the latest final assistant response from the active OpenCode session with a global slash command. The copied result is readable plain text and does not require another model request.

## Requirements

### Requirement: Global command copies the latest final assistant response

The system SHALL expose `/copy-last` in the OpenCode CLI TUI for globally configured users. Invoking the command SHALL copy the latest completed, user-visible assistant response from the active session without submitting a prompt to the model.

#### Scenario: Copy the latest answer in the active session

- **WHEN** the user invokes `/copy-last` in an OpenCode session that contains a completed assistant response
- **THEN** the latest final user-visible assistant response from that session is sent to the terminal clipboard

#### Scenario: Command runs outside an active session

- **WHEN** the user invokes `/copy-last` while the TUI is not showing a session
- **THEN** the system leaves the clipboard unchanged and reports that there is no active session

### Requirement: Internal and intermediate assistant content is excluded

The system SHALL exclude reasoning, tool calls and results, intermediate assistant messages that continue into tool activity, and child-session output when selecting the response to copy.

#### Scenario: A tool-using turn has an intermediate message and a final answer

- **WHEN** an assistant turn contains text before a tool call and a completed final response after the tool activity
- **THEN** `/copy-last` copies the completed final response and excludes the intermediate text and tool content

#### Scenario: The current session has no completed final response

- **WHEN** the active session contains no completed final assistant response with user-visible text
- **THEN** the system leaves the clipboard unchanged and reports that there is no response to copy

### Requirement: Copied responses are normalized as plain text

The system SHALL remove common Markdown formatting while retaining the response's readable structure. It SHALL keep paragraphs and list items on separate lines, remove heading and blockquote markers, preserve code contents and indentation without fenced-code markers or language labels, and represent links as their visible text followed by the URL in parentheses. Markdown table rows SHALL retain their pipe separators in the copied text.

#### Scenario: Normalize common Markdown while preserving structure

- **WHEN** the final response contains headings, paragraphs, lists, inline formatting, a code block, a link, and a Markdown table
- **THEN** the copied text retains paragraph and list structure, includes the code without its fences, formats a link as `label (URL)`, and retains table pipe separators

### Requirement: Command reports copy success and failure

The system SHALL show a brief success notification when the terminal clipboard accepts the copied response. It SHALL show an error notification and leave the clipboard unchanged when the terminal clipboard is unavailable or rejects the copy.

#### Scenario: Terminal clipboard accepts the response

- **WHEN** `/copy-last` finds a final response and the terminal clipboard accepts it
- **THEN** the system shows a success notification

#### Scenario: Terminal clipboard is unsupported

- **WHEN** `/copy-last` finds a final response but the terminal does not support clipboard output
- **THEN** the system leaves the clipboard unchanged and shows an error notification
