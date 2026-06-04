# shared-diagnostics Specification

## Purpose

The shared diagnostics module provides structured error serialization, HTTP response diagnostics, and failure payload construction for pi extensions, ensuring consistent error reporting across all tools.

## Requirements

### Requirement: Structured Error Serialization

The system SHALL provide a shared diagnostics helper that serializes unknown thrown values into a structured error object.

#### Scenario: Serializing an Error object

- **WHEN** an `Error` object is serialized
- **THEN** the result SHALL include `name` and `message`
- **AND** the result SHALL include `code` when the error exposes a string `code` property
- **AND** the result SHALL NOT include a stack trace

#### Scenario: Serializing a non-Error value

- **WHEN** a non-Error thrown value is serialized
- **THEN** the result SHALL include a `message` field derived from the value string representation

#### Scenario: Serializing immediate cause

- **WHEN** a thrown value has a `cause`
- **THEN** the result SHALL include a `cause` object serialized with the same single-error shape
- **AND** nested causes beyond the immediate cause SHALL NOT be recursively expanded

### Requirement: HTTP Response Diagnostics

The system SHALL provide shared diagnostics helpers for representing HTTP response failures.

#### Scenario: Capturing non-OK response details

- **WHEN** a response is converted to diagnostics
- **THEN** the result SHALL include `status` and `statusText`
- **AND** the result SHALL include a bounded `bodySnippet` derived from the response body when it can be read

#### Scenario: Response body cannot be read

- **WHEN** the response body cannot be read while building diagnostics
- **THEN** the diagnostics helper SHALL still return response details with `status` and `statusText`
- **AND** the helper SHALL use a fallback body snippet instead of throwing

### Requirement: HTTP Response Error

The system SHALL provide a shared error type that carries structured HTTP response diagnostics.

#### Scenario: Throwing an HTTP response error

- **WHEN** code throws the shared HTTP response error type
- **THEN** the error SHALL behave as an `Error`
- **AND** the error SHALL expose the structured response diagnostics used to construct it

#### Scenario: Extracting response details from an error

- **WHEN** response details are requested from the shared HTTP response error type
- **THEN** the helper SHALL return the attached response diagnostics

#### Scenario: Extracting response details from another error

- **WHEN** response details are requested from any other thrown value
- **THEN** the helper SHALL return no response diagnostics

### Requirement: Failure Payload Construction

The system SHALL provide a shared helper that builds a standard failure payload fragment from an unknown thrown value.

#### Scenario: Failure payload for generic error

- **WHEN** a generic thrown value is converted into a failure payload
- **THEN** the payload SHALL include `error` with the structured serialized error
- **AND** the payload SHALL omit `response`

#### Scenario: Failure payload for HTTP response error

- **WHEN** the shared HTTP response error type is converted into a failure payload
- **THEN** the payload SHALL include `error` with the structured serialized error
- **AND** the payload SHALL include `response` with the attached HTTP response diagnostics

### Requirement: Shared Diagnostics Adoption

Pi extensions SHALL use the shared diagnostics helpers for migrated failure logs that need structured error details.

#### Scenario: Web tools use shared diagnostics

- **WHEN** web-search or web-fetch logs migrated failure diagnostics
- **THEN** the payload SHALL be built using the shared diagnostics helpers rather than a web-tools-local diagnostics module

#### Scenario: Existing extensions use shared diagnostics for obvious failures

- **WHEN** selected quota or context failure logs are migrated
- **THEN** those logs SHALL use a structured `error` object instead of a plain error message string
- **AND** the migration SHALL preserve event names and extension control flow
