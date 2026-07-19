import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";

const articles = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/articles" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    type: z.enum(["nyhet", "förklarar", "analys", "opinion"]),
    category: z.string(),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    author: z.string(),
    featured: z.boolean().default(false),
    sources: z.array(z.object({ label: z.string(), url: z.string().url() })).default([]),
    relatedDocumentIds: z.array(z.string()).default([]),
  }),
});

export const collections = { articles };
