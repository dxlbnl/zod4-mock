import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createWorld } from "../../../src/index.js";

/**
 * Cascading / Nested Schemas Integration Test
 *
 * Demonstrates that matchers registered for schemas are correctly applied
 * when those schemas are nested (directly or recursively) inside others.
 */
describe("Cascading Schemas Integration", () => {
  it("applies matchers across a nested hierarchy (Enterprise -> Dept -> Employee)", () => {
    // 1. Define nested schemas
    const EmployeeSchema = z.object({
      id: z.string().uuid(),
      name: z.string(),
    });

    const DepartmentSchema = z.object({
      id: z.string(),
      // Force small arrays to keep output on "one screen"
      employees: z.array(EmployeeSchema).min(1).max(2),
    });

    const EnterpriseSchema = z.object({
      name: z.string(),
      departments: z.array(DepartmentSchema).min(1).max(2),
    });

    const world = createWorld({ seed: 42 });

    // 2. Register matchers for all levels
    world
      .withSchema(EmployeeSchema, {
        matchers: { name: () => "MATCHED_EMPLOYEE" },
      })
      .withSchema(DepartmentSchema, {
        matchers: { id: () => "MATCHED_DEPT" },
      })
      .withSchema(EnterpriseSchema, {
        matchers: { name: () => "MATCHED_ENTERPRISE" },
      });

    // 3. Generate the top-level schema
    const result = world.generate(EnterpriseSchema);

    // 4. Verify cascade
    expect(result.name).toBe("MATCHED_ENTERPRISE");
    expect(result.departments[0]?.id).toBe("MATCHED_DEPT");
    expect(result.departments[0]?.employees[0]?.name).toBe("MATCHED_EMPLOYEE");
  });

  it("applies matchers in a recursive tree structure", () => {
    interface Node {
      name: string;
      children: Node[];
    }
    const NodeSchema: z.ZodType<Node> = z.lazy(() =>
      z.object({
        name: z.string(),
        children: z.array(NodeSchema).max(1), // Keep it small for "one screen"
      }),
    );

    const world = createWorld({ seed: 42, recursionLimit: 10 });

    world.withSchema(NodeSchema, {
      matchers: {
        name: () => "MATCHED_NODE",
      },
    });

    const result = world.generate(NodeSchema);

    // Verify root
    expect(result.name).toBe("MATCHED_NODE");

    // Verify children (if any) also use the matcher
    if (result.children.length > 0) {
      expect(result.children[0]!.name).toBe("MATCHED_NODE");
      if (result.children[0]!.children.length > 0) {
        expect(result.children[0]!.children[0]!.name).toBe("MATCHED_NODE");
      }
    }
  });
});
