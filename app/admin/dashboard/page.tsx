import { supabase } from "@/lib/supabase";

export default async function AdminDashboard() {
  const { data: deployments } = await supabase
    .from("deployments")
    .select("*, users(email)");

  return (
    <div className="min-h-screen bg-[#07090e] text-white p-8 font-sans">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">👑 Admin Master View</h1>
        <p className="text-slate-400 text-sm">
          Track customer deployments, usage cases, and remaining active days.
        </p>
      </div>

      <div className="overflow-x-auto border border-slate-800 rounded-xl bg-[#0e131f] shadow-2xl">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-[#080b12] border-b border-slate-800 text-slate-400 uppercase text-xs font-mono">
            <tr>
              <th className="p-4">Customer</th>
              <th className="p-4">Bot Type</th>
              <th className="p-4">Org / Individual</th>
              <th className="p-4">Use Case</th>
              <th className="p-4">Days Remaining</th>
              <th className="p-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {deployments?.map((item) => {
              const daysLeft = Math.ceil(
                ((item.expires_at ? new Date(item.expires_at).getTime() : Date.now() + 30 * 86400000) - Date.now()) / (1000 * 3600 * 24)
              );

              return (
                <tr key={item.id} className="hover:bg-slate-900/40 transition">
                  <td className="p-4 font-medium text-white">{item.users?.email || "User"}</td>
                  <td className="p-4">{item.template_name}</td>
                  <td className="p-4">
                    <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-md text-xs text-slate-200">
                      {item.organization_name || "Individual Use"}
                    </span>
                  </td>
                  <td className="p-4 max-w-xs truncate text-slate-400">
                    {item.use_case_description || "No description provided"}
                  </td>
                  <td className="p-4 font-bold">
                    <span className={daysLeft <= 3 ? "text-red-400" : "text-emerald-400"}>
                      {daysLeft > 0 ? `${daysLeft} Days` : "Expired"}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      item.status === 'RUNNING' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-red-950 text-red-400 border border-red-800'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}