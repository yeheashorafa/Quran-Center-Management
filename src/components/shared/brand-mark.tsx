import Image from "next/image";
import { appConfig } from "@/config/app";

type BrandMarkProps = {
  compact?: boolean;
};

export function BrandMark({ compact = false }: BrandMarkProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-2.5">
        <div className="relative size-10 shrink-0">
          <Image
            src="/logo.png"
            alt={`شعار ${appConfig.centerName}`}
            fill
            priority
            sizes="40px"
            className="object-contain"
          />
        </div>
        <div className="text-right">
          <p className="text-xs font-black text-emerald-950 sm:text-sm">
            {appConfig.centerName}
          </p>
          <p className="text-[10px] font-bold text-amber-700">
            تطبيق متابعة التلاوة والتحفيظ
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative size-24 sm:size-28">
        <Image
          src="/brand/logo.png"
          alt={`شعار ${appConfig.centerName}`}
          fill
          priority
          sizes="112px"
          className="object-contain"
        />
      </div>
      <div className="mt-3">
        <h2 className="text-base font-black text-emerald-950 sm:text-lg">
          {appConfig.centerName}
        </h2>
        <p className="mt-0.5 text-xs font-bold text-amber-700">
          نظام متابعة التلاوة والتحفيظ والتقارير
        </p>
      </div>
    </div>
  );
}
