export type StudentTransferHistoryItem = {
  id: string;
  transferDate: string;
  note: string | null;
  createdAt: string;
  transferredByName: string | null;
  fromEnrollment: {
    id: string;
    startedOn: string;
    endedOn: string | null;
    halaqa: {
      id: string;
      nameAr: string;
      stageName: string;
    };
  };
  toEnrollment: {
    id: string;
    startedOn: string;
    endedOn: string | null;
    halaqa: {
      id: string;
      nameAr: string;
      stageName: string;
    };
  };
};
