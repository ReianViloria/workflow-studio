<!-- AUTO-GENERATED FILE: DO NOT EDIT SPECS.md DIRECTLY. -->
<!-- Edit boards/starter-blueprint/graph.json and content/*.md (or use http://localhost:3333) -->

# Starter Architecture Blueprint (Compiled Single-File Agent Context)

## Workflow Graph Hierarchy

- **[System Architecture Root](#node-root)** `[IN-PROGRESS]` `[2 QUESTIONS]` (`content/root.md`) — *High-level project scope, boundaries, and entry point for this workflow.*
  - **[1. Input & API Layer](#node-input-layer)** `[TODO]` (`content/input-layer.md`) — *Request validation, auth guards, and input normalization.*
    - **[2. Core Business Logic](#node-core-logic)** `[TODO]` (`content/core-logic.md`) — *Primary domain rules, state transitions, and pure testable logic.*
      - **[3. Storage & Downstream Output](#node-storage-output)** `[TODO]` (`content/storage-output.md`) — *Database persistence, events, webhooks, or external API handoff.*
  - **[New Playbook Node](#node-custom-node-2754-2)** (`content/custom-node-2754-2.md`) — *Document key workflows, checklists, and reusable templates for this step.*

---

<a id="node-root"></a>

<!-- NODE_META: id="root" slug="root" path="System Architecture Root" -->
> **Graph Path:** System Architecture Root  
> **Source File:** `admin/boards/starter-blueprint/content/root.md` | **Status:** `IN-PROGRESS` | **Branches To:** 1. Input & API Layer → New Playbook Node

# System Architecture Root

Overview of this project's goals, boundaries, and key constraints.

## Scope & Boundaries
- **In Scope:** Core numbered spine (`1 → 2 → 3`).
- **Out of Scope / Optional:** Mark unused branches `Skipped` so they are excluded from `SPECS.md`.

### Open Questions (2)

- [ ] Hello test
- [ ] Another test

---

<a id="node-input-layer"></a>

<!-- NODE_META: id="input-layer" slug="input-layer" path="System Architecture Root > 1. Input & API Layer" -->
> **Graph Path:** System Architecture Root → 1. Input & API Layer  
> **Source File:** `admin/boards/starter-blueprint/content/input-layer.md` | **Status:** `TODO` | **Branches To:** 2. Core Business Logic

# 1. Input & API Layer

Handles incoming requests, authentication/authorization checks, and schema validation.

## Edge Cases
- Reject malformed payloads early with clear `400` errors.

## Test Checklist
- [ ] Validates required input schema fields.
- [ ] Enforces auth/permission checks.

---

<a id="node-core-logic"></a>

<!-- NODE_META: id="core-logic" slug="core-logic" path="System Architecture Root > 1. Input & API Layer > 2. Core Business Logic" -->
> **Graph Path:** System Architecture Root → 1. Input & API Layer → 2. Core Business Logic  
> **Source File:** `admin/boards/starter-blueprint/content/core-logic.md` | **Status:** `TODO` | **Branches To:** 3. Storage & Downstream Output

# 2. Core Business Logic

Pure, framework-independent domain rules and state transitions.

## Test Checklist
- [ ] Covers primary happy path and boundary conditions with unit tests.

---

<a id="node-storage-output"></a>

<!-- NODE_META: id="storage-output" slug="storage-output" path="System Architecture Root > 1. Input & API Layer > 2. Core Business Logic > 3. Storage & Downstream Output" -->
> **Graph Path:** System Architecture Root → 1. Input & API Layer → 2. Core Business Logic → 3. Storage & Downstream Output  
> **Source File:** `admin/boards/starter-blueprint/content/storage-output.md` | **Status:** `TODO`

# 3. Storage & Downstream Output

Persists state to database/object storage and emits downstream events or webhooks.

## Test Checklist
- [ ] Writes are idempotent on retries.
- [ ] Handles upstream timeouts gracefully.

---

<a id="node-custom-node-2754-2"></a>

<!-- NODE_META: id="custom-node-2754-2" slug="custom-node-2754-2" path="System Architecture Root > New Playbook Node" -->
> **Graph Path:** System Architecture Root → New Playbook Node  
> **Source File:** `admin/boards/starter-blueprint/content/custom-node-2754-2.md`

# New Playbook Node

> Document key workflows, checklists, and reusable templates for this step.

## Action Checklist

- [ ] Define clear scope and acceptance criteria
- [ ] Add copy-paste template or runbook snippet below

```markdown
### Reusable Template
Replace this block with your copy-paste playbook template.
```

---
