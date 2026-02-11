import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma, getOrCreateDbUser } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: automationId } = await params;
    const body = await request.json();
    const { isFavorite } = body;

    const user = await currentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in." },
        { status: 401 }
      );
    }

    const dbUser = await getOrCreateDbUser(user.id);

    const automation = await prisma.automation.findUnique({
      where: { id: automationId },
    });

    if (!automation) {
      return NextResponse.json(
        { error: "Automation not found." },
        { status: 404 }
      );
    }

    if (automation.userId !== dbUser.id) {
      return NextResponse.json(
        { error: "You don't have permission to update this automation." },
        { status: 403 }
      );
    }

    await prisma.automation.update({
      where: { id: automationId },
      data: { isFavorite: Boolean(isFavorite) },
    });

    return NextResponse.json({ success: true, isFavorite });
  } catch (error) {
    console.error("Error updating favorite:", error);
    return NextResponse.json(
      { error: "Failed to update favorite." },
      { status: 500 }
    );
  }
}
