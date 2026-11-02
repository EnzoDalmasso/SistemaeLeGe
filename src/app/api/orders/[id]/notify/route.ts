import { idParam, route } from "@/lib/api";
import { notifyReady } from "@/lib/orders";

export const POST = route<{ params: Promise<{ id: string }> }>(async (_req, { params }) => notifyReady(idParam((await params).id)));
