import Image from "next/image";

export default function Logo() {
  return (
    <div className="w-10 h-10 aspect-square rounded-lg flex items-center justify-center bg-#2C2B25 overflow-hidden">
      <Image src="/logo.png" alt="Logo" width={40} height={40} className="object-contain" />
    </div>
  );
}