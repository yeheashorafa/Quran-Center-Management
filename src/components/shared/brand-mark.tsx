import Image from "next/image";
import { appConfig } from "@/config/app";

type BrandMarkProps = {
  compact?: boolean;
};

export function BrandMark({ compact = false }: BrandMarkProps) {
  if (compact) {
    return (
      <div className="flex items-center">
        <div className="relative size-24 sm:size-28 shrink-0">
          <Image
            src="/brand/logo.png"
            alt={`شعار ${appConfig.centerName}`}
            fill
            priority
            sizes="112px"
            className="object-contain"
          />
        </div>
        {/* <div className="text-right">
          <p className="text-xs font-black  sm:text-sm">
            {appConfig.centerName}
          </p>
          <p className="text-[10px] font-bold text-amber-900 dark:text-amber-200">
            تطبيق متابعة التلاوة والتحفيظ
          </p>
        </div> */}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative size-56">
        <Image
          src="/brand/logo.png"
          alt={`شعار ${appConfig.centerName}`}
          fill
          priority
          sizes="224px"
          className="object-contain"
        />
      </div>
      {/* <div className="mt-3">
        <h2 className="text-base  font-black  sm:text-lg">
          {appConfig.centerName}
        </h2>
        <p className="mt-0.5 text-xs font-bold ligth:text-amber-900 dark:text-amber-200">
          نظام متابعة التلاوة والتحفيظ والتقارير
        </p>
      </div> */}
    </div>
  );
}
