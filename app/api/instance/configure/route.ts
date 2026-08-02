import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const { instanceId, organizationType, organizationName, useCase } = await req.json();

    const { error } = await supabase
      .from("deployments")
      .update({
        organization_type: organizationType,
        organization_name: organizationName,
        use_case_description: useCase,
      })
      .eq("id", instanceId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}