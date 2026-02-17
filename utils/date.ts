// Utility to get Islamic Date
export const getIslamicDate = () => {
    const today = new Date();
    const formatter = new Intl.DateTimeFormat('en-US-u-ca-islamic', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric'
    });

    const parts = formatter.formatToParts(today);
    const month = parseInt(parts.find(p => p.type === 'month')?.value || '1');
    const day = parseInt(parts.find(p => p.type === 'day')?.value || '1');
    const year = parseInt(parts.find(p => p.type === 'year')?.value || '1445');

    return { month, day, year };
};

// Check if it's Ramadan (Month 9) and return status
export const getRamadanStatus = () => {
    const { month, day } = getIslamicDate();

    // Ramadan is the 9th month of the Islamic calendar
    const isRamadan = month === 9;

    // Assuming 30 days for calculation safety, though strictly it observes the moon
    const totalDays = 30;
    const daysRemaining = isRamadan ? Math.max(1, totalDays - day + 1) : 30;

    return { isRamadan, daysRemaining, currentDay: day };
};
