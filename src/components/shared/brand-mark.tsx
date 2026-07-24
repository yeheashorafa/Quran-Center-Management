import { appConfig } from "@/config/app";
import { DynamicLogo } from "@/components/shared/dynamic-logo";

type BrandMarkProps = {
  compact?: boolean;
};

export function BrandMark({ compact = false }: BrandMarkProps) {
  if (compact) {
    return (
      <div className="flex items-center">
        <div className="relative size-24 sm:size-28 shrink-0">
          <DynamicLogo
            alt={`شعار ${appConfig.centerName}`}
            sizes="112px"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative size-56">
        <DynamicLogo
          alt={`شعار ${appConfig.centerName}`}
          sizes="224px"
        />
      </div>
    </div>
  );
}
