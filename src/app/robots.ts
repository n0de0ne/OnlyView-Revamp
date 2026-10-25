import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

const PRIVATE = ["/admin", "/api/", "/account", "/contracts/"];

/**
 * The crawlers that feed search and AI answers, welcomed by name. The site
 * *is* the marketing: being read, indexed and quoted is the point, so every
 * search-engine, answer-engine and training crawler gets the same open door
 * (and the same closed one on the private areas).
 */
const AI_BOTS = [
  // OpenAI: training, ChatGPT search index, on-demand fetches
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  // Anthropic
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "anthropic-ai",
  // Perplexity
  "PerplexityBot",
  "Perplexity-User",
  // Google (search, AI Overviews / Gemini grounding, Vertex)
  "Googlebot",
  "Googlebot-Image",
  "Google-Extended",
  "Google-CloudVertexBot",
  // Microsoft Bing → Copilot, ChatGPT search
  "Bingbot",
  // Apple (Siri, Spotlight, Apple Intelligence)
  "Applebot",
  "Applebot-Extended",
  // the others that answer questions
  "DuckAssistBot",
  "YouBot",
  "Amazonbot",
  "Meta-ExternalAgent",
  "Meta-ExternalFetcher",
  "MistralAI-User",
  "cohere-ai",
  "CCBot",
  "PetalBot",
  "YandexBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: PRIVATE,
      },
      ...AI_BOTS.map((userAgent) => ({ userAgent, allow: "/", disallow: PRIVATE })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
