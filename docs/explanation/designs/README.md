# Designs

Proposals for open design questions. A proposal explains a problem and the options for solving it, so the decision can be made with the trade-offs in view. Once decided, the outcome is recorded in [decisions](../decisions/README.md), and the proposal links to that record.

There are no open proposals yet. The questions they're likely to start from are in [Known limitations](../limitations.md).

## Writing a proposal

Create `designs/<short-topic>.md`:

```markdown
# <Topic>

Status: Open | Decided in [NNNN](../decisions/NNNN-title.md) | Abandoned

## Problem

What doesn't work today, or what we want to be possible, and for whom.

## Constraints

Requirements and limits any solution must respect.

## Options

### <Option A>

How it would work, and its consequences: benefits, costs, risks.

### <Option B>

…

## Open questions

What must be answered before deciding.
```

A proposal stays explanation. It describes and compares, but doesn't include implementation steps or API reference; those belong in how-to and reference pages once the design is built.
