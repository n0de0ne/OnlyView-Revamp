import { prisma } from "./db";

export interface PublicTestimonial {
  id: number;
  name: string;
  country: string | null;
  rating: number;
  message: string;
  language: string;
  stayDate: Date | null;
}

export async function getApprovedTestimonials(limit?: number): Promise<PublicTestimonial[]> {
  try {
    return await prisma.testimonial.findMany({
      where: { isApproved: true },
      orderBy: [{ isFeatured: "desc" }, { stayDate: "desc" }],
      take: limit,
      select: {
        id: true,
        name: true,
        country: true,
        rating: true,
        message: true,
        language: true,
        stayDate: true,
      },
    });
  } catch {
    return [];
  }
}
