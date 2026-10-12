import { EegGrid } from "@/components/EegGrid";
import { Sidebar } from "@/components/Sidebar";

export default function Home() {
  return (
    <div className="app">
      <Sidebar />
      <EegGrid />
    </div>
  );
}
