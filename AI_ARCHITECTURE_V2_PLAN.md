# AI ARCHITECTURE V2 PLAN: The Expert Real Estate Advisor

**Date:** 2026-04-22
**Status:** Request for Comments (RFC) - Revised
**Author:** Lead Developer (Antigravity)

---

## 1. Executive Understanding

The transition from Phase B (a structured "filter translator") to V2 (an "Expert Real Estate Advisor") represents a fundamental shift in how Nido AI interacts with users. We are moving from a reactive search mechanism to a proactive, highly contextual advisory experience. 

For Nido to scale effectively and retain users, the AI must bridge the gap between human intent and rigid database constraints. Users don't just search for "2 bedrooms, 2 bathrooms"; they search for "un apartaestudio cerca a mi universidad con buen transporte, por ahí en 2 palos". A rigid system fails these nuanced queries, leading to zero results and user drop-off. By upgrading the AI to understand deep Colombian colloquialisms, leverage lifestyle matching natively without heavy external dependencies, and negotiate smoothly when exact matches aren't found, we drastically improve the user experience (UX), increase property discovery, and maximize conversion rates.

## 2. Technical Approach & Tooling

To achieve the new capabilities while keeping the system native, lean, and robust, we will implement a multi-layered approach:

*   **Dialect & Slang Parsing (System Prompt Restructuring):** 
    *   We will significantly expand the `DICCIONARIO DE SINÓNIMOS` in the System Prompt.
    *   Explicit rules for colloquial numbers (e.g., "lucas" = 1,000 COP, "palos" = 1,000,000 COP) will be handled directly in `searchWithAI.ts` before calling the RPC. This is highly effective and requires zero external API calls.
*   **Lifestyle Matching (PostgreSQL Full-Text Search):**
    *   Instead of heavy `pgvector` embeddings, we will use native PostgreSQL Full-Text Search (`to_tsvector`, `to_tsquery`) on the `caracteristicas_externas` and `descripcion` columns.
    *   The `searchTool` Schema will accept a `lifestyle_query` string. The backend will parse this string to perform high-speed, native text matching for lifestyle requests (e.g., "hospital", "parque", "transporte"). This is zero-cost and much faster for our scale.
*   **Hierarchical Fallback & Zero-Result Handling (The "Price is Sacred" Rule):**
    *   To prevent hallucination when strict filters yield 0 results, the backend RPC (`search_properties`) will perform a Hierarchical Fallback:
        *   **Pass 1 (Strict):** Everything the user asked for.
        *   **Pass 2 (Relaxed Amenities):** If Pass 1 is empty, ignore `caracteristicas_externas` and `amenities`, but keep Price, City, and Type.
        *   **Pass 3 (Relaxed Type):** If Pass 2 is empty, ignore `tipo_inmueble` (e.g., show a house if they asked for an apartment).
    *   **Crucially**, Price and City will NEVER be relaxed automatically. The AI will receive the "relaxed level" from the RPC and adopt a negotiation persona: *"No tengo un apartamento con parqueadero en ese presupuesto, pero encontré estas casas que te podrían interesar. ¿Quieres revisarlas o prefieres que ajustemos el precio?"*

## 3. Scalability Strategy (The 10k+ User Rule)

As we scale to 10,000+ concurrent users, latency and operational costs are our primary focus.

*   **Zero External Dependency for Matching:** By rejecting `pgvector` and using PostgreSQL Full-Text Search, we eliminate the need for embedding generation via external APIs, ensuring zero additional cost per query and massive improvements in query speed.
*   **Token Optimization:** The expanded System Prompt will be highly optimized to avoid redundant instructions. The fallback logic happens entirely in a single fast RPC hit, so we don't multiply LLM calls.
*   **Edge Functions & Caching:** We will leverage semantic caching (e.g., Redis) where common queries (e.g., "apartamentos en laureles medellin por 3 palos") return cached database results instead of hitting the Gemini API every single time.
*   **Asynchronous Processing:** The summarization call is already gracefully degraded. Under extreme load, we can bypass the summarization LLM call entirely and rely on standard UI rendering if API latency exceeds a strict threshold.

## 4. Development & Testing Methodology

We will execute this upgrade iteratively to protect the stable Phase B core:

1.  **Iteration 1: Slang & Prompt Expansion (Low Risk):** Update the `SYSTEM_PROMPT` with the new dictionary for Colombian money slang ("lucas", "palos"). Verify that this mapping correctly parses inside `searchWithAI.ts`.
2.  **Iteration 2: Native Full-Text Search (Medium Risk):** Update the `search_properties` RPC to incorporate `to_tsvector` and `to_tsquery` matching on a new `lifestyle_query` parameter.
3.  **Iteration 3: Hierarchical Fallback Logic (High Impact/Effort):** Modify the `search_properties` RPC to include the 3-pass fallback mechanism. Ensure the RPC returns an `exact_match_level` indicator. Update the AI prompt to handle the negotiation dialogue based on this indicator.
4.  **Verification:** Each iteration will undergo strict manual testing to ensure the AI respects the "Price is Sacred" rule and does not hallucinate properties. We will use a separate development branch to prevent disrupting the `main` production environment.
