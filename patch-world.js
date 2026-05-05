const fs = require("fs");
let content = fs.readFileSync("src/world.ts", "utf8");

// 1. Add getTopologicallySortedTypes
content = content.replace(
  "  private ensureAllTypesHaveSubjects(): void {",
  `  private getTopologicallySortedTypes(): string[] {
    const visited = new Set<string>();
    const temp = new Set<string>();
    const order: string[] = [];

    const visit = (typeName: string) => {
      if (temp.has(typeName)) throw new Error(\`Circular dependency detected involving '\${typeName}'\`);
      if (visited.has(typeName)) return;

      temp.add(typeName);
      const subjectType = this.subjectTypes.get(typeName);
      if (subjectType?.relations) {
        for (const rel of Object.values(subjectType.relations)) {
          if (this.subjectTypes.has(rel.type)) {
            visit(rel.type);
          }
        }
      }
      temp.delete(typeName);
      visited.add(typeName);
      order.push(typeName);
    };

    for (const typeName of this.subjectTypes.keys()) {
      visit(typeName);
    }
    return order;
  }

  /**
   * Ensure every registered subject type has at least one instance.
   * Called before any subject-based generation so that matchers that call
   * \`ctx.registry.pick(otherType)\` always find data.
   */
  private ensureAllTypesHaveSubjects(): void {`,
);

// 2. Update ensureAllTypesHaveSubjects
content = content.replace(
  /  private ensureAllTypesHaveSubjects\(\): void \{\n    for \(const typeName of this\.subjectTypes\.keys\(\)\) \{\n      if \(this\.getInstancesOfType\(typeName\)\.length === 0\) \{\n        this\.createSubjectInstance\(typeName\);\n      \}\n    \}\n  \}/g,
  `  private ensureAllTypesHaveSubjects(): void {
    const order = this.getTopologicallySortedTypes();
    for (const typeName of order) {
      if (this.getInstancesOfType(typeName).length === 0) {
        this.createSubjectInstance(typeName);
      }
    }
  }`,
);

// 3. Add resolveRelation and resolveReverseRelation
content = content.replace(
  "  private getInstancesOfType(typeName: string): AnySubjectInstance[] {",
  `  private resolveRelation<T>(instance: AnySubjectInstance, relName: string): T {
    if (relName in instance._relations) {
      const cached = instance._relations[relName];
      if (cached === null) return undefined as unknown as T;
      if (Array.isArray(cached)) return cached.map(c => c.data) as unknown as T;
      return (cached as AnySubjectInstance).data as unknown as T;
    }

    const subjectType = this.subjectTypes.get(instance._type)!;
    const relDef = subjectType.relations?.[relName];
    if (!relDef) {
      throw new Error(\`Relation '\${relName}' is not defined on subject type '\${instance._type}'.\`);
    }

    const relPrng = this.prng.fork(\`rel-\${instance._id}-\${relName}\`);
    const targetType = relDef.type;
    
    let existing = this.getInstancesOfType(targetType);
    let count = 0;
    switch (relDef.cardinality) {
      case "1": count = 1; break;
      case "0..1": count = relPrng.random() < 0.5 ? 1 : 0; break;
      case "0..n": count = relPrng.int(0, 3); break;
      case "1..n": count = relPrng.int(1, 3); break;
    }

    const selected: AnySubjectInstance[] = [];
    for (let i = 0; i < count; i++) {
      if (existing.length === 0) {
        this.createSubjectInstance(targetType);
        existing = this.getInstancesOfType(targetType);
      }
      selected.push(existing[relPrng.int(0, existing.length - 1)]!);
    }

    if (relDef.cardinality === "1" || relDef.cardinality === "0..1") {
      const result = selected[0] ?? null;
      instance._relations[relName] = result as any;
      return (result ? result.data : undefined) as unknown as T;
    } else {
      instance._relations[relName] = selected;
      return selected.map(s => s.data) as unknown as T;
    }
  }

  private resolveReverseRelation<T>(instance: AnySubjectInstance, targetType: string, relName: string): T[] {
    const targets = this.getInstancesOfType(targetType);
    const results: AnySubjectInstance[] = [];
    
    for (const target of targets) {
      this.resolveRelation(target, relName); // Force resolve
      
      const related = target._relations[relName];
      if (Array.isArray(related)) {
        if (related.includes(instance)) results.push(target);
      } else if (related === instance) {
        results.push(target);
      }
    }
    
    return results.map(r => r.data) as unknown as T[];
  }

  private getInstancesOfType(typeName: string): AnySubjectInstance[] {`,
);

// 4. Update createSubjectInstance (relations object and instance array push)
content = content.replace(
  /    const subjectPrng = createPrng\(fieldSeed\(this\.options\.seed, _id, ""\)\);\n\n    const ctx: GeneratorContext = \{/g,
  `    const subjectPrng = createPrng(fieldSeed(this.options.seed, _id, ""));

    const rawData: Record<string, unknown> = {};
    const instance: AnySubjectInstance = { _type: typeName, _id, data: rawData as SubjectData<AnySubjectType>, _relations: {} };
    this.allInstances.push(instance); // Push early so reverse lookup finds it

    const ctx: GeneratorContext = {`,
);

content = content.replace(
  /      optionalProbability: 0, \/\/ subject data always fully populated\n    \};/g,
  `      optionalProbability: 0,
      related: <T>(relName: string) => this.resolveRelation<T>(instance, relName),
      relatedTo: <T>(targetType: string, relName: string) => this.resolveReverseRelation<T>(instance, targetType, relName),
    };`,
);

content = content.replace(
  /    const rawData: Record<string, unknown> = \{\};\n    for \(const \[key, fieldSchema\]/g,
  `    for (const [key, fieldSchema]`,
);

content = content.replace(
  /    const data = rawData as SubjectData<AnySubjectType>;\n\n    const instance: AnySubjectInstance = \{ _type: typeName, _id, data \};\n    this\.allInstances\.push\(instance\);\n    this\.registry\.store\(typeName, data\); \/\/ store raw subject data, not the wrapper/g,
  `    this.registry.store(typeName, instance.data);`,
);

// 5. Update generateItemForSubject ctx
content = content.replace(
  /      optionalProbability: this\.options\.optionalProbability \?\? 0\.2,\n    \};\n\n    const result/g,
  `      optionalProbability: this.options.optionalProbability ?? 0.2,
      related: <T>(relName: string) => this.resolveRelation<T>(instance, relName),
      relatedTo: <T>(targetType: string, relName: string) => this.resolveReverseRelation<T>(instance, targetType, relName),
    };

    const result`,
);

// 6. Update generateSingleItem ctx (adhoc generation)
content = content.replace(
  /        optionalProbability: this\.options\.optionalProbability \?\? 0\.2,\n      \};\n\n      \/\/ If a keyMap is registered/g,
  `        optionalProbability: this.options.optionalProbability ?? 0.2,
        related: <T>(relName: string) => { throw new Error(\`Cannot call related('\${relName}') on ad-hoc generation. No active subject.\`); },
        relatedTo: <T>(targetType: string, relName: string) => { throw new Error(\`Cannot call relatedTo() on ad-hoc generation.\`); },
      };

      // If a keyMap is registered`,
);

// 7. Update generateArray (adhoc generation)
content = content.replace(
  /          fieldPath: `\[\$\{i\}\]`,\n          optionalProbability: this\.options\.optionalProbability \?\? 0\.2,\n        \}\)/g,
  `          fieldPath: \`[\${i}]\`,
          optionalProbability: this.options.optionalProbability ?? 0.2,
          related: <T>(relName: string) => { throw new Error(\`Cannot call related('\${relName}') on ad-hoc generation. No active subject.\`); },
          relatedTo: <T>(targetType: string, relName: string) => { throw new Error(\`Cannot call relatedTo() on ad-hoc generation.\`); },
        })`,
);

fs.writeFileSync("src/world.ts", content);
