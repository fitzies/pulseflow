import { Workflow } from "lucide-react";
import Link from "next/link";

export default function Logo() {
  return <div className="w-10 h-10 aspect-square rounded-lg flex items-center justify-center bg-#2C2B25">
    <Link href={"/"}>
      <Workflow />
    </Link>
  </div>
}