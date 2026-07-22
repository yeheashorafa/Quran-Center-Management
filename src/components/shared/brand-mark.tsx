import Image from "next/image";
import { appConfig } from "@/config/app";

type BrandMarkProps = {
  compact?: boolean;
};

export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className={compact ? "relative size-20" : "relative size-28 sm:size-32"}>
        <Image
          src="/brand/logo.png"
          alt={`شعار ${appConfig.centerName}`}
          fill
          priority
          sizes={compact ? "80px" : "128px"}
          className="object-contain"
        />
      </div>
      <div className="mt-2">
        <p className="text-lg font-extrabold text-[var(--brand-green)] sm:text-xl">
          {appConfig.centerName}
        </p>
        <p className="mt-1 text-xs font-semibold text-[var(--brand-gold-dark)] sm:text-sm">
          تطبيق متابعة التحفيظ
        </p>
      </div>
    </div>
  );
}
