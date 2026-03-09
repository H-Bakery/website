---
id: TASK-024
aliases:
  - TASK-024
title: Fix Frontend TypeScript Errors in Test Files
slug: fix-frontend-typescript-errors-in-test-files
status: done
priority: 1
owner: ''
projects: []
customers: []
tags:
  - bugs
sprint: ''
depends_on: []
due_date: ''
created: 2026-02-28
updated: 2026-03-09
---

Resolve TypeScript type errors in several frontend test files (UnsoldProductsForm.test.tsx, RecipeForm.test.tsx, ThemeContext.test.tsx) to ensure the test suite compiles successfully.

## Details

The goal of this task is to eliminate all TypeScript compilation errors originating from the specified test files. Start by running `npx tsc --noEmit` or `npm test` to see the full list of errors. Address the errors in each file by ensuring that mocked props, context values, and test data structures correctly match their corresponding type definitions.

1.  **UnsoldProductsForm.test.tsx**: Investigate type mismatches for props being passed to the component within the tests. This likely involves form handlers (`onSubmit`), form state, or initial data. Ensure any mocked functions or objects align with the component's prop types.
2.  **RecipeForm.test.tsx**: Similar to the above, focus on correcting the types for mocked props, especially for complex data structures like ingredients or recipe steps. If custom hooks are used, ensure their mocked return values are correctly typed.
3.  **ThemeContext.test.tsx**: The errors are likely related to the value provided to the `ThemeContext.Provider` in the test setup. Ensure the mock context object matches the defined context type, including all its properties (e.g., `theme`, `toggleTheme`).

Avoid using `any` or `@ts-ignore` as a solution. Instead, use proper types, interfaces, or TypeScript utility types like `Partial` or `jest.Mock` to correctly type test-specific implementations.
