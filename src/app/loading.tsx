import { Spinner } from "@/components/ui/spinner"

export default function Loading() {
  return <div className="w-screen h-screen flex items-center justify-center">
    <Spinner />
  </div>
}