export { searchRoutes } from "./adapters/http/routes";
export { createClaudeSearchAgent } from "./adapters/llm/claude-search-agent";
export { createNovaSearchAgent } from "./adapters/llm/nova-search-agent";
export { createTitanEmbedder } from "./adapters/llm/titan-embedder";
export type { Embed } from "./application/embed";
export { createKeepCatalogInStep } from "./application/keep-catalog-in-step";
export { createSearch, type Search } from "./application/search";
export type { SearchAgent } from "./application/search-agent";
export type { SearchEvent, Suggestion } from "./domain/search-event";
