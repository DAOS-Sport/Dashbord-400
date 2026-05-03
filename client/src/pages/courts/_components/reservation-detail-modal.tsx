import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, ClockIcon, MapPinIcon, UserIcon, PhoneIcon, FileTextIcon } from "lucide-react";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import { getCourtName } from "@/lib/court-utils";
import type { CourtReservation as Reservation } from "@shared/schema";

interface ReservationDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  reservation: Reservation | null;
}

const PHONE_PLACEHOLDERS = new Set([
  "後台匯入",
  "從 Google Calendar 匯入",
  "Google Calendar",
  "google calendar",
]);

const isRealPhone = (phone?: string | null): phone is string => {
  if (!phone) return false;
  const trimmed = phone.trim();
  if (!trimmed) return false;
  if (PHONE_PLACEHOLDERS.has(trimmed)) return false;
  return /\d/.test(trimmed);
};

export function ReservationDetailModal({ isOpen, onClose, reservation }: ReservationDetailModalProps) {
  if (!reservation) return null;

  const getStatusText = (status: string) => {
    switch (status) {
      case "confirmed": return "已確認";
      case "pending": return "待確認";
      case "member": return "會員";
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed": return "bg-blue-100 text-blue-800";
      case "pending": return "bg-yellow-100 text-yellow-800";
      case "member": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const showPhone = isRealPhone(reservation.phone);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" data-testid="reservation-detail-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            預約詳細資訊
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-gray-500" />
              <div>
                <div className="font-semibold text-lg">{reservation.customerName}</div>
                {reservation.bookingNumber && (
                  <div className="text-sm text-gray-500">
                    預約編號 #{reservation.bookingNumber}
                  </div>
                )}
              </div>
            </div>

            {reservation.serviceName && (
              <div className="flex items-center gap-2">
                <FileTextIcon className="w-4 h-4 text-gray-500" />
                <span className="text-sm">{reservation.serviceName}</span>
              </div>
            )}

            {showPhone && (
              <div className="flex items-center gap-2">
                <PhoneIcon className="w-4 h-4 text-gray-500" />
                <span className="text-sm">{reservation.phone}</span>
              </div>
            )}
          </div>

          <div className="border-t pt-3 space-y-3">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-gray-500" />
              <span className="text-sm">
                {format(new Date(reservation.date + "T00:00:00"), "yyyy年M月d日 (EEEE)", { locale: zhTW })}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <ClockIcon className="w-4 h-4 text-gray-500" />
              <span className="text-sm">
                {reservation.startTime} - {reservation.endTime}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <MapPinIcon className="w-4 h-4 text-gray-500" />
              <span className="text-sm">
                {getCourtName(reservation.court)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Badge className={getStatusColor(reservation.status)}>
                {getStatusText(reservation.status)}
              </Badge>
            </div>
          </div>

          {reservation.notes && (
            <div className="border-t pt-3">
              <div className="text-sm font-medium text-gray-700 mb-2">備註</div>
              <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                {reservation.notes}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
