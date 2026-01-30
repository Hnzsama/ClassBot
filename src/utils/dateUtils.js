const parseWIB = (timeStr) => {
    if (!timeStr) return null;
    // Remove "WIB" and clean
    const cleanTime = timeStr.replace(/[^\d\-: ]/g, "").trim();

    // Attempt ISO-like
    try {
        // If only date provided (YYYY-MM-DD), add time
        let isoStr = cleanTime;
        if (!cleanTime.includes(":")) isoStr += " 23:59";

        const isoStart = isoStr.replace(" ", "T") + ":00+07:00";
        const date = new Date(isoStart);
        return isNaN(date.getTime()) ? null : date;
    } catch (e) { return null; }
};

const formatDateIndo = (date) => {
    if (!date) return "-";
    return date.toLocaleDateString("id-ID", {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
};

module.exports = { parseWIB, formatDateIndo };
