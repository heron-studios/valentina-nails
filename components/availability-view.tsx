import { useState, useMemo } from 'react';
import { es } from 'date-fns/locale';
import {
  CalendarDays,
  Clock3,
  Sparkles,
  Check,
  Lock,
  ArrowRight,
  ChevronRight,
  ShieldCheck,
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
      <section className="px-5 py-8 sm:px-10 lg:px-16 max-w-7xl mx-auto flex-1 w-full">
        {/* Header */}
        <div className="section-heading text-center max-w-3xl mx-auto mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#fbf3e6] border border-[#ebd4b0] text-[#94671e] text-xs font-semibold uppercase tracking-wider mb-3">
            <span className="live-pulse-dot" /> Agenda en vivo en tiempo real
          </div>
          <h2 className="text-3xl sm:text-4xl font-display font-medium text-[#2d221e]">
            Disponibilidad del Atelier
          </h2>
          <p className="mt-2 text-[#685c56] text-sm sm:text-base">
            Explora libremente el calendario en vivo. Revisa qué fechas y horarios están disponibles u ocupados sin ningún compromiso.
          </p>
        </div>

        {/* Next Available Slot Spotlight Banner */}
        {nextSlot ? (
          <div className="next-slot-banner mb-10">
            <div className="next-slot-info">
              <div className="next-slot-badge">
                <Sparkles className="w-4 h-4 text-[#c9a054]" />
                <span>Próximo espacio disponible</span>
              </div>
              <h3 className="next-slot-title">
                {nextSlot.isToday
                  ? `¡Hoy mismo a las ${nextSlot.time}!`
                  : nextSlot.isTomorrow
                    ? `Mañana a las ${nextSlot.time}`
                    : `${formatBookingDatePEN(nextSlot.dateKey)} · ${nextSlot.time}`}
              </h3>
              <p className="next-slot-subtitle">
                {nextSlot.isToday
                  ? `Quedan ${nextSlot.totalFreeSlotsForDay} turno${nextSlot.totalFreeSlotsForDay > 1 ? 's' : ''} libre${nextSlot.totalFreeSlotsForDay > 1 ? 's' : ''} para hoy.`
                  : nextSlot.daysUntil <= 3
                    ? `A solo ${nextSlot.daysUntil} día${nextSlot.daysUntil > 1 ? 's' : ''} con ${nextSlot.totalFreeSlotsForDay} turnos disponibles.`
                    : `${nextSlot.totalFreeSlotsForDay} horarios disponibles en esa fecha.`}
              </p>
            </div>
            <button
              type="button"
              className="gold-button next-slot-cta"
              onClick={() => onSelectSlotAndBook(nextSlot.date, nextSlot.time)}
            >
              Apartar este turno ({nextSlot.time}) <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="next-slot-banner mb-10">
            <div className="next-slot-info">
              <h3 className="next-slot-title">Agenda completa por los próximos días</h3>
              <p className="next-slot-subtitle">Consulta fechas futuras en el calendario interactivo a continuación.</p>
            </div>
          </div>
        )}

        {/* Main Grid: Calendar on Left, Hourly Breakdown on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-12">
          {/* Calendar Panel (7 cols on desktop) */}
          <div className="lg:col-span-7 availability-card">
            <div className="availability-card-header">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-[#94671e]" />
                <h3 className="text-lg font-semibold text-[#281f1c]">Selecciona una fecha</h3>
              </div>
              <span className="text-xs text-[#8c7a72]">Toca un día para ver sus horas</span>
            </div>

            <div className="flex justify-center p-2 sm:p-4">
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
                className="booking-calendar w-full max-w-md"
                classNames={{
                  month_grid: 'w-full border-collapse',
                  day: 'relative aspect-square h-full w-full rounded-full p-0 text-center transition-all',
                  today: 'rounded-full bg-[#f8e7eb] text-[#8d4b60] font-bold',
                }}
              />
            </div>

            {/* Calendar Legend */}
            <div className="availability-legend">
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

          {/* Day Slots Breakdown Panel (5 cols on desktop) */}
          <div className="lg:col-span-5 availability-card">
            <div className="availability-card-header">
              <div className="flex items-center gap-2">
                <Clock3 className="w-5 h-5 text-[#94671e]" />
                <h3 className="text-lg font-semibold text-[#281f1c]">
                  {selectedDate ? formatBookingDatePEN(formatDateKey(selectedDate)) : 'Horarios del día'}
                </h3>
              </div>
              {dayStats && !dayStats.isClosed && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#f4ece3] text-[#7d5619] font-medium">
                  {dayStats.freeSlots} libres · {dayStats.occupiedSlots} ocupados
                </span>
              )}
            </div>

            <div className="p-4 sm:p-6">
              {!selectedDate ? (
                <div className="text-center py-12 text-[#8c7a72]">
                  <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-40 text-[#c9a054]" />
                  <p className="font-medium text-[#483d37]">Selecciona un día en el calendario</p>
                  <p className="text-xs mt-1 text-[#8c7a72]">Verás qué horas están libres u ocupadas en tiempo real.</p>
                </div>
              ) : dayStats?.isClosed ? (
                <div className="text-center py-12 text-[#8c7a72]">
                  <div className="w-12 h-12 rounded-full bg-[#f5e9ea] text-[#9b4d58] grid place-items-center mx-auto mb-3">
                    <Lock className="w-6 h-6" />
                  </div>
                  <h4 className="font-display text-lg text-[#3f2a2e]">Domingo cerrado</h4>
                  <p className="text-xs text-[#7d686c] mt-2 max-w-xs mx-auto">
                    Los domingos nuestro atelier permanece cerrado para mantenimiento, descanso y esterilización de herramientas.
                  </p>
                  <p className="text-xs text-[#94671e] font-medium mt-4">
                    Selecciona de lunes a sábado para ver disponibilidad.
                  </p>
                </div>
              ) : dayStats?.isFullyBooked ? (
                <div className="text-center py-10">
                  <div className="w-12 h-12 rounded-full bg-[#f7ebe6] text-[#b05234] grid place-items-center mx-auto mb-3">
                    <Lock className="w-6 h-6" />
                  </div>
                  <h4 className="font-display text-lg text-[#3d2722]">Día completamente reservado</h4>
                  <p className="text-xs text-[#705e57] mt-2 max-w-xs mx-auto">
                    Todos los turnos de esta fecha ya han sido reservados por otras clientas.
                  </p>
                  {nextSlot && (
                    <button
                      type="button"
                      className="mt-5 text-xs text-[#94671e] font-semibold underline underline-offset-4 hover:text-[#724c11]"
                      onClick={() => {
                        onSelectDate(nextSlot.date);
                      }}
                    >
                      Ir al próximo día libre ({formatBookingDatePEN(nextSlot.dateKey)}) →
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <p className="text-xs text-[#6a5c55] mb-4">
                    Toca un horario disponible para apartarlo en la agenda:
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
                          className={`slot-pill ${
                            isFree ? 'slot-pill-free' : 'slot-pill-occupied'
                          } ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleSelectSlot(time, isFree)}
                          aria-label={`${time} - ${isFree ? 'Disponible' : 'Ocupado'}`}
                        >
                          <div className="flex items-center gap-1.5">
                            {isFree ? (
                              <span className="slot-indicator-free" />
                            ) : (
                              <Lock className="w-3 h-3 text-[#9b8d86]" />
                            )}
                            <strong className="text-sm font-semibold">{time}</strong>
                          </div>
                          <span className="slot-state-text">
                            {isFree ? 'Disponible' : 'Ocupado'}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-6 pt-5 border-t border-[#ebd8ce] flex items-center justify-between gap-3">
                    <div className="text-xs text-[#7a6b64]">
                      <span>Horario seleccionado: </span>
                      <strong className="text-[#3a2e29]">
                        {activeTimePreview || 'Elige un horario arriba'}
                      </strong>
                    </div>
                    <button
                      type="button"
                      className="gold-button text-xs py-2 px-4"
                      onClick={() => {
                        if (activeTimePreview && selectedDate) {
                          onSelectSlotAndBook(selectedDate, activeTimePreview);
                        } else {
                          onGoToBooking();
                        }
                      }}
                    >
                      {activeTimePreview ? 'Apartar este horario' : 'Ir a reservar'} <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Feature Strip / Guarantee */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-[#ebd8ce]">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[rgba(255,255,255,0.7)] border border-[rgba(201,160,84,0.2)]">
            <div className="w-8 h-8 rounded-full bg-[#fbf3e6] grid place-items-center text-[#94671e]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="text-xs text-[#52453e]">
              <strong className="block text-[#2e231f]">Cero sobrecupos</strong>
              <span>Tu cita es 100% exclusiva y puntual.</span>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-[rgba(255,255,255,0.7)] border border-[rgba(201,160,84,0.2)]">
            <div className="w-8 h-8 rounded-full bg-[#fbf3e6] grid place-items-center text-[#94671e]">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="text-xs text-[#52453e]">
              <strong className="block text-[#2e231f]">Bioseguridad grado atelier</strong>
              <span>Esterilización entre cada turno.</span>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-[rgba(255,255,255,0.7)] border border-[rgba(201,160,84,0.2)]">
            <div className="w-8 h-8 rounded-full bg-[#fbf3e6] grid place-items-center text-[#94671e]">
              <Check className="w-4 h-4" />
            </div>
            <div className="text-xs text-[#52453e]">
              <strong className="block text-[#2e231f]">Confirmación inmediata</strong>
              <span>Directo a WhatsApp con tu cotización.</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer>
        <p>
          Lunes a viernes · {catalog.schedule.weekdays.join(', ')}<br />
          Sábado · {catalog.schedule.saturday.join(', ')} · Domingo cerrado
        </p>
        <a className="footer-whatsapp" href={`https://wa.me/${catalog.whatsapp}`}>
          WhatsApp del Atelier
        </a>
      </footer>
    </div>
  );
}
