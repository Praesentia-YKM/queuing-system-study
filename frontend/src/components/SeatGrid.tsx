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
            <div className="flex gap-4 mb-4 text-sm">
                <span className="flex items-center gap-1"><span className="w-4 h-4 bg-green-100 rounded inline-block"></span> 선택 가능</span>
                <span className="flex items-center gap-1"><span className="w-4 h-4 bg-blue-500 rounded inline-block"></span> 내 선택</span>
                <span className="flex items-center gap-1"><span className="w-4 h-4 bg-red-400 rounded inline-block"></span> 예매됨</span>
            </div>
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                {Array.from({ length: totalSeats }, (_, i) => {
                    const seatNo = i + 1;
                    const isReserved = reservedSeats.includes(seatNo);
                    const isSelected = selectedSeat === seatNo;

                    return (
                        <button
                            key={seatNo}
                            onClick={() => !isReserved && onSelect(seatNo)}
                            disabled={isReserved}
                            className={`w-10 h-10 rounded text-xs font-mono transition
                                ${isReserved ? 'bg-red-400 text-white cursor-not-allowed' :
                                  isSelected ? 'bg-blue-500 text-white' :
                                  'bg-green-100 hover:bg-green-300 cursor-pointer'}`}
                        >
                            {seatNo}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
