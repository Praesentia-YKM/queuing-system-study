'use client';

interface SeatGridProps {
    totalSeats: number;
    reservedSeats: number[];
    selectedSeat: number | null;
    onSelect: (seatNo: number) => void;
}

export default function SeatGrid({ totalSeats, reservedSeats, selectedSeat, onSelect }: SeatGridProps) {
    const cols = 10;

    return (
        <div>
            {/* Stage indicator */}
            <div className="mb-6 text-center">
                <div
                    className="inline-block text-[12px] font-semibold tracking-wider px-8 py-2 rounded-t-xl"
                    style={{ background: 'var(--color-border-light)', color: 'var(--color-text-tertiary)' }}
                >
                    STAGE
                </div>
                <div className="h-px" style={{ background: 'var(--color-border)' }} />
            </div>

            {/* Legend */}
            <div className="flex justify-center gap-5 mb-5">
                <span className="flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
                    <span className="w-3 h-3 rounded" style={{ background: 'var(--color-border-light)' }} />
                    선택 가능
                </span>
                <span className="flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
                    <span className="w-3 h-3 rounded" style={{ background: 'var(--color-blue)' }} />
                    내 선택
                </span>
                <span className="flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
                    <span className="w-3 h-3 rounded" style={{ background: 'var(--color-red)', opacity: 0.6 }} />
                    예매됨
                </span>
            </div>

            {/* Row labels + seats */}
            <div className="flex flex-col items-center gap-[3px]">
                {Array.from({ length: Math.ceil(totalSeats / cols) }, (_, row) => (
                    <div key={row} className="flex items-center gap-[3px]">
                        <span
                            className="w-5 text-right text-[11px] font-medium mr-1"
                            style={{ color: 'var(--color-text-tertiary)' }}
                        >
                            {String.fromCharCode(65 + row)}
                        </span>
                        {Array.from({ length: cols }, (_, col) => {
                            const seatNo = row * cols + col + 1;
                            if (seatNo > totalSeats) return <div key={col} className="w-9 h-9" />;

                            const isReserved = reservedSeats.includes(seatNo);
                            const isSelected = selectedSeat === seatNo;

                            return (
                                <button
                                    key={seatNo}
                                    onClick={() => !isReserved && onSelect(seatNo)}
                                    disabled={isReserved}
                                    className="w-9 h-9 rounded-lg text-[11px] font-medium transition-all duration-150"
                                    style={{
                                        background: isReserved ? 'rgba(240, 68, 82, 0.12)' :
                                            isSelected ? 'var(--color-blue)' : 'var(--color-border-light)',
                                        color: isReserved ? 'rgba(240, 68, 82, 0.5)' :
                                            isSelected ? 'white' : 'var(--color-text-secondary)',
                                        cursor: isReserved ? 'not-allowed' : 'pointer',
                                        transform: isSelected ? 'scale(1.08)' : 'scale(1)',
                                        boxShadow: isSelected ? '0 2px 8px rgba(49, 130, 246, 0.3)' : 'none',
                                    }}
                                    onMouseEnter={e => {
                                        if (!isReserved && !isSelected) {
                                            (e.currentTarget as HTMLElement).style.background = 'var(--color-blue-light)';
                                            (e.currentTarget as HTMLElement).style.color = 'var(--color-blue)';
                                        }
                                    }}
                                    onMouseLeave={e => {
                                        if (!isReserved && !isSelected) {
                                            (e.currentTarget as HTMLElement).style.background = 'var(--color-border-light)';
                                            (e.currentTarget as HTMLElement).style.color = 'var(--color-text-secondary)';
                                        }
                                    }}
                                >
                                    {col + 1}
                                </button>
                            );
                        })}
                        <span
                            className="w-5 text-left text-[11px] font-medium ml-1"
                            style={{ color: 'var(--color-text-tertiary)' }}
                        >
                            {String.fromCharCode(65 + row)}
                        </span>
                    </div>
                ))}
            </div>

            {/* Column numbers */}
            <div className="flex justify-center gap-[3px] mt-2 ml-6 mr-6">
                <span className="w-5 mr-1" />
                {Array.from({ length: cols }, (_, i) => (
                    <span key={i} className="w-9 text-center text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                        {i + 1}
                    </span>
                ))}
            </div>
        </div>
    );
}
