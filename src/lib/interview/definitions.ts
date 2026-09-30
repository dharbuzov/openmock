import type { InterviewDefinition, InterviewLevel } from "./types";

const levels: InterviewLevel[] = [
  { id: "junior", name: "Junior" }, { id: "middle", name: "Middle" },
  { id: "senior", name: "Senior" }, { id: "staff", name: "Staff" },
  { id: "principal", name: "Principal" },
];
const recommendations = ["strong-hire", "hire", "mixed", "no-hire", "strong-no-hire"] as const;

const definitions: InterviewDefinition[] = [
  {
    id: "dsa", name: "Data Structures and Algorithms", version: 1, revision: "builtin-dsa-v1", workspace: "code",
    stages: [{ id: "approach" }, { id: "implementation" }, { id: "analysis" }, { id: "wrap-up" }],
    levels, modes: ["practice", "mock"], duration: { defaultMinutes: 45 },
    evaluation: {
      competencies: [
        { id: "problem-solving", name: "Problem solving" }, { id: "communication", name: "Communication" },
        { id: "technical-depth", name: "Technical depth" }, { id: "trade-offs", name: "Trade-offs" },
      ],
      recommendations: [...recommendations],
    },
    instructions: `# DSA interview

Inspect the current code and ask about reasoning, correctness, complexity, edge cases, duplicates, and examples. Do not claim you compiled or executed code. Progress naturally from approach through implementation and analysis.`,
  },
  {
    id: "system-design", name: "System Design", version: 1, revision: "builtin-system-design-v1", workspace: "diagram",
    stages: [
      { id: "requirements", name: "Requirements" }, { id: "high-level-design", name: "High-level design" },
      { id: "deep-dive", name: "Deep dive" }, { id: "failure-scenarios", name: "Failure scenarios" },
      { id: "trade-offs", name: "Trade-offs" }, { id: "wrap-up", name: "Wrap-up" },
    ],
    levels, modes: ["practice", "mock"], duration: { defaultMinutes: 60 },
    evaluation: {
      competencies: [
        { id: "requirements-scope", name: "Requirements & scope" }, { id: "architecture", name: "Architecture" },
        { id: "data-state", name: "Data & state" }, { id: "scalability", name: "Scalability" },
        { id: "reliability", name: "Reliability" }, { id: "trade-offs", name: "Trade-offs" },
        { id: "communication", name: "Communication" },
      ],
      recommendations: [...recommendations],
    },
    instructions: `# System Design interview

Progress naturally through requirements, a high-level design, relevant deep dives, failure scenarios, trade-offs, and wrap-up. Follow the candidate's design instead of treating stages as a rigid checklist.

Act as the customer for reasonable clarifications and keep established constraints consistent. Ask for estimates only when they materially inform the design. Challenge the candidate using their own components and decisions without revealing the full answer. Use the current normalized architecture diagram only as evidence of nodes, labels, and connections actually present.`,
  },
];

export function getInterviewDefinition(id: string): InterviewDefinition | undefined {
  return definitions.find((definition) => definition.id === id);
}

export function requireInterviewDefinition(id: string): InterviewDefinition {
  const definition = getInterviewDefinition(id);
  if (!definition) throw new Error(`Unknown interview definition: ${id}`);
  return definition;
}
