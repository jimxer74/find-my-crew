---
description: 
alwaysApply: true
---

<!-- BACKLOG.MD MCP GUIDELINES START -->

<CRITICAL_INSTRUCTION>

## BACKLOG WORKFLOW INSTRUCTIONS

This project uses Backlog.md MCP for all task and project management activities.

**CRITICAL GUIDANCE**

- If your client supports MCP resources, read `backlog://workflow/overview` to understand when and how to use Backlog for this project.
- If your client only supports tools or the above request fails, call `backlog.get_workflow_overview()` tool to load the tool-oriented overview (it lists the matching guide tools).

- **First time working here?** Read the overview resource IMMEDIATELY to learn the workflow
- **Already familiar?** You should have the overview cached ("## Backlog.md Overview (MCP)")
- **When to read it**: BEFORE creating tasks, or when you're unsure whether to track work

These guides cover:
- Decision framework for when to create tasks
- Search-first workflow to avoid duplicates
- Links to detailed guides for task creation, execution, and finalization
- MCP tools reference

You MUST read the overview resource to understand the complete workflow. The information is NOT summarized here.

</CRITICAL_INSTRUCTION>

<!-- BACKLOG.MD MCP GUIDELINES END -->

## DATABASE SCHEMA INSTRUCTIONS

**CRITICAL:** Whenever you make changes to the database schema (creating tables, adding columns, modifying indexes, adding RLS policies, etc.):

1. Create a migration file in `/migrations/` with the next sequential number (e.g., `004_description.sql`)
2. **ALWAYS** update `/specs/tables.sql` to reflect the new schema - this file serves as the single source of truth for the database structure
3. If creating TypeScript types for new tables, add them in `app/lib/` following existing patterns

## TASK MANAGEMENT INSTRUCTIONS

**CRITICAL:** For complex tasks (multiple files, multiple steps, or multi-phase implementations):

1. **ALWAYS** create a todo list first using `TaskCreate` before starting implementation
2. Break down the work into clear, actionable items
3. Update task status as you progress (`in_progress` when starting, `completed` when done)
4. This helps track progress and ensures nothing is missed

## UI AND LAYOUT PRINCIPLES

**App Header Visibility:** The main application header (`<Header />` component) must ALWAYS remain visible. When creating new pages, wizards, forms, or any UI components:

1. **NEVER** use fixed full-screen overlays (`fixed inset-0`) that cover the header
2. **ALWAYS** render page content below the header, not on top of it
3. For multi-step wizards or forms, replace the main content area while keeping the header visible
4. **PROPOSE** generalization and creation or refactoring existing functionalities and ui into reusable components
