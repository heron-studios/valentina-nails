import { useState, useMemo } from 'react';
import { es } from 'date-fns/locale';
import {
  CalendarDays,
  Clock3,
  Sparkles,
  Lock,
  ChevronRight,
  MessageCircle,
} from 'lucide-react';
import { Calendar } from './ui/calendar.tsx';
import type { SalonCatalog } from '../lib/catalog.ts';
import { formatBookingDatePEN } from '../lib/format-utils.ts';
import {
  getNextAvailableSlot,
  getDayAvailabilityStats,
  formatDateKey,
} from '../lib/availability.ts';

export interface AvailabilityViewProps {
  catalog: SalonCatalog;
  occupiedByDate: Record<string, string[]>;
  selectedDate: Date | undefined;
  onSelectDate: (date: Date | undefined) => void;
  onSelectSlotAndBook: (date: Date, time: string) => void;
  onGoToBooking: () => void;
}

export function AvailabilityView({
  catalog,
  occupiedByDate,
  selectedDate,
  onSelectDate,
  onSelectSlotAndBook,
  onGoToBooking,
}: AvailabilityViewProps) {
  const [activeTimePreview, setActiveTimePreview] = useState<string | null>(null);

  // Compute next available slot in real-time
  const nextSlot = useMemo(
    () => getNextAvailableSlot(occupiedByDate, catalog.schedule),
    [occupiedByDate, catalog.schedule],
  );

  // Stats for the currently selected day
  const dayStats = useMemo(() => {
    if (!selectedDate) return null;
    return getDayAvailabilityStats(selectedDate, occupiedByDate, catalog.schedule);
  }, [selectedDate, occupiedByDate, catalog.schedule]);

  // All times for the selected day
  const dayTimes = useMemo<string[]>(() => {
    if (!selectedDate) return [];
    return selectedDate.getDay() === 6
      ? catalog.schedule.saturday
      : catalog.schedule.weekdays;
  }, [selectedDate, catalog.schedule]);

  const isDayFullyBooked = (date: Date) => {
    const stats = getDayAvailabilityStats(date, occupiedByDate, catalog.schedule);
    return stats.isFullyBooked;
  };

  const isDayClosed = (date: Date) => date.getDay() === 0;

  const handleSelectSlot = (time: string, isFree: boolean) => {
    if (!isFree || !selectedDate) return;
    setActiveTimePreview(time);
    onSelectSlotAndBook(selectedDate, time);
  };

  return (
    <div className="tab-view-container availability-view-container">
      <section className="px-4 py-3 sm:px-8 sm:py-4 lg:px-12 max-w-7xl mx-auto flex-1 w-full flex flex-col justify-between overflow-hidden">
        {/* Compact Header & Next Slot in 1 Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-[#ebd8ce]/60 flex-shrink-0">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[#94671e] text-[0.7rem] font-bold uppercase tracking-wider">
              <span className="live-pulse-dot" /> Agenda en vivo en tiempo real
            </div>
            <h2 className="text-xl sm:text-2xl font-display font-medium text-[#2d221e] leading-tight">
              Disponibilidad del Atelier
            </h2>
          </div>

          {nextSlot && (
            <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-[#fdf6ec] to-[#fbf1e2] border border-[#ebd4b0] shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-[#c9a054] flex-shrink-0" />
              <div className="text-xs text-[#52453e] leading-tight">
                <span className="font-semibold text-[#8c5d18]">
                  {nextSlot.isToday
                    ? `Hoy a las ${nextSlot.time}`
                    : nextSlot.isTomorrow
                      ? `Mañana a las ${nextSlot.time}`
                      : `${formatBookingDatePEN(nextSlot.dateKey)} · ${nextSlot.time}`}
                </span>
                <span className="hidden md:inline text-[0.7rem] text-[#7d6e67] ml-1">
                  ({nextSlot.totalFreeSlotsForDay} libre{nextSlot.totalFreeSlotsForDay > 1 ? 's' : ''})
                </span>
              </div>
              <button
                type="button"
                className="gold-button text-[0.68rem] py-1 px-2.5 rounded-full shadow-none"
                onClick={() => onSelectSlotAndBook(nextSlot.date, nextSlot.time)}
              >
                Apartar ({nextSlot.time})
              </button>
            </div>
          )}
        </div>

        {/* Main 2-Column Content: Left Calendar, Right Day Slots */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch flex-1 min-h-0 py-2.5 overflow-hidden">
          {/* Calendar Panel (7 cols) */}
          <div className="lg:col-span-7 availability-card flex flex-col justify-between overflow-hidden">
            <div className="availability-card-header py-2 px-3.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-[#94671e]" />
                <h3 className="text-sm font-semibold text-[#281f1c]">Selecciona una fecha</h3>
              </div>
              <span className="text-[0.7rem] text-[#8c7a72]">Toca un día para ver turnos</span>
            </div>

            <div className="flex justify-center p-1 sm:p-2 flex-1 items-center overflow-hidden">
              <Calendar
                mode="single"
                locale={es}
                selected={selectedDate}
                onSelect={onSelectDate}
                disabled={(date) => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  return date < today || isDayClosed(date);
                }}
                modifiers={{
                  fullyBooked: isDayFullyBooked,
                  closedDay: isDayClosed,
                }}
                modifiersClassNames={{
                  fullyBooked: 'fully-booked-day',
                  closedDay: 'closed-day',
                }}
                className="booking-calendar w-full max-w-sm"
                classNames={{
                  month_grid: 'w-full border-collapse',
                  day: 'relative aspect-square h-full w-full rounded-full p-0 text-center transition-all text-xs sm:text-sm',
                  today: 'rounded-full bg-[#f8e7eb] text-[#8d4b60] font-bold',
                }}
              />
            </div>

            {/* Calendar Legend */}
            <div className="availability-legend py-1.5 px-3 text-[0.7rem]">
              <div className="legend-item">
                <span className="legend-dot legend-free" />
                <span>Disponible</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot legend-full" />
                <span>Día completo</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot legend-closed" />
                <span>Domingo cerrado</span>
              </div>
            </div>
          </div>

          {/* Day Slots Breakdown Panel (5 cols) */}
          <div className="lg:col-span-5 availability-card flex flex-col justify-between overflow-hidden">
            <div className="availability-card-header py-2 px-3.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Clock3 className="w-4 h-4 text-[#94671e]" />
                <h3 className="text-sm font-semibold text-[#281f1c] truncate">
                  {selectedDate ? formatBookingDatePEN(formatDateKey(selectedDate)) : 'Horarios del día'}
                </h3>
              </div>
              {dayStats && !dayStats.isClosed && (
                <span className="text-[0.68rem] px-2 py-0.5 rounded-full bg-[#f4ece3] text-[#7d5619] font-medium whitespace-nowrap">
                  {dayStats.freeSlots} libres · {dayStats.occupiedSlots} ocupados
                </span>
              )}
            </div>

            <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between overflow-y-auto">
              {!selectedDate ? (
                <div className="text-center py-8 text-[#8c7a72] my-auto">
                  <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-40 text-[#c9a054]" />
                  <p className="font-medium text-sm text-[#483d37]">Selecciona un día en el calendario</p>
                  <p className="text-xs mt-0.5 text-[#8c7a72]">Verás qué horas están libres u ocupadas al instante.</p>
                </div>
              ) : dayStats?.isClosed ? (
                <div className="text-center py-6 text-[#8c7a72] my-auto">
                  <div className="w-9 h-9 rounded-full bg-[#f5e9ea] text-[#9b4d58] grid place-items-center mx-auto mb-2">
                    <Lock className="w-4 h-4" />
                  </div>
                  <h4 className="font-display text-base text-[#3f2a2e]">Domingo cerrado</h4>
                  <p className="text-xs text-[#7d686c] mt-1 max-w-xs mx-auto">
                    Los domingos nuestro atelier permanece cerrado por descanso y preparación de insumos.
                  </p>
                </div>
              ) : dayStats?.isFullyBooked ? (
                <div className="text-center py-6 my-auto">
                  <div className="w-9 h-9 rounded-full bg-[#f7ebe6] text-[#b05234] grid place-items-center mx-auto mb-2">
                    <Lock className="w-4 h-4" />
                  </div>
                  <h4 className="font-display text-base text-[#3d2722]">Día completamente reservado</h4>
                  <p className="text-xs text-[#705e57] mt-1 max-w-xs mx-auto">
                    Todos los turnos de esta fecha ya han sido reservados.
                  </p>
                  {nextSlot && (
                    <button
                      type="button"
                      className="mt-3 text-xs text-[#94671e] font-semibold underline underline-offset-4 hover:text-[#724c11]"
                      onClick={() => onSelectDate(nextSlot.date)}
                    >
                      Ir al próximo día libre ({formatBookingDatePEN(nextSlot.dateKey)}) →
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <p className="text-[0.72rem] text-[#6a5c55] mb-2 font-medium">
                      Toca un horario disponible para apartarlo:
                    </p>
                    <div className="availability-slots-grid">
                      {dayTimes.map((time: string) => {
                        const isOccupied = occupiedByDate[formatDateKey(selectedDate)]?.includes(time);
                        const isFree = !isOccupied;
                        const isSelected = activeTimePreview === time;

                        return (
                          <button
                            key={time}
                            type="button"
                            disabled={!isFree}
                            className={`slot-pill py-1.5 px-2.5 ${
                              isFree ? 'slot-pill-free' : 'slot-pill-occupied'
                            } ${isSelected ? 'selected' : ''}`}
                            onClick={() => handleSelectSlot(time, isFree)}
                            aria-label={`${time} - ${isFree ? 'Disponible' : 'Ocupado'}`}
                          >
                            <div className="flex items-center gap-1">
                              {isFree ? (
                                <span className="slot-indicator-free" />
                              ) : (
                                <Lock className="w-2.5 h-2.5 text-[#9b8d86]" />
                              )}
                              <strong className="text-xs font-semibold">{time}</strong>
                            </div>
                            <span className="slot-state-text text-[0.65rem]">
                              {isFree ? 'Disponible' : 'Ocupado'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-[#ebd8ce] flex items-center justify-between gap-2">
                    <div className="text-[0.72rem] text-[#7a6b64] truncate">
                      <span>Horario: </span>
                      <strong className="text-[#3a2e29]">
                        {activeTimePreview || 'Elige arriba'}
                      </strong>
                    </div>
                    <button
                      type="button"
                      className="gold-button text-[0.72rem] py-1.5 px-3 whitespace-nowrap"
                      onClick={() => {
                        if (activeTimePreview && selectedDate) {
                          onSelectSlotAndBook(selectedDate, activeTimePreview);
                        } else {
                          onGoToBooking();
                        }
                      }}
                    >
                      {activeTimePreview ? 'Apartar horario' : 'Ir a reservar'} <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Micro Footer Line */}
        <div className="flex items-center justify-between text-[0.68rem] text-[#8c7b74] pt-2 border-t border-[#ebd8ce]/50 flex-shrink-0">
          <span>Lunes a viernes: {catalog.schedule.weekdays[0]} - {catalog.schedule.weekdays[catalog.schedule.weekdays.length - 1]} · Sábado: {catalog.schedule.saturday[0]} - {catalog.schedule.saturday[catalog.schedule.saturday.length - 1]}</span>
          <a className="text-[#94671e] hover:underline font-medium inline-flex items-center gap-1" href={`https://wa.me/${catalog.whatsapp}`}>
            <MessageCircle className="w-3 h-3" /> WhatsApp
          </a>
        </div>
      </section>
    </div>
  );
}
