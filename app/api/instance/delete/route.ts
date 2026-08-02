import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function DELETE(req: Request) {
  try {
    const { instanceId } = await req.json();

    const { error } = await supabase
      .from("deployments")
      .delete()
      .eq("id", instanceId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}