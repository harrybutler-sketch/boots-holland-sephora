import React from 'react';

const Filters = ({ filters, onFilterChange, workspace = 'beauty' }) => {
    const handleChange = (e) => {
        const { name, value } = e.target;
        onFilterChange({ ...filters, [name]: value });
    };

    const retailers = workspace === 'beauty'
        ? ['Sephora', 'Holland & Barrett']
        : ['Sainsburys', 'Tesco', 'Asda', 'Morrisons', 'Ocado', 'Waitrose'];

    return (
        <div className="card filters">
            <div className="form-group">
                <label htmlFor="retailer">Retailer</label>
                <select
                    id="retailer"
                    name="retailer"
                    className="select"
                    value={filters.retailer}
                    onChange={handleChange}
                >
                    <option value="All">All Retailers</option>
                    {retailers.map(r => (
                        <option key={r} value={r}>{r}</option>
                    ))}
                </select>
            </div>

            <div className="form-group">
                <label htmlFor="days">Time Period</label>
                <select
                    id="days"
                    name="days"
                    className="select"
                    value={filters.days}
                    onChange={handleChange}
                >
                    <option value="7">Last 7 Days</option>
                    <option value="14">Last 14 Days</option>
                    <option value="28">Last 28 Days</option>
                    <option value="90">Last 3 Months</option>
                    <option value="">All Time</option>
                </select>
            </div>

            <div className="form-group" style={{ flexGrow: 1 }}>
                <label htmlFor="q">Search</label>
                <input
                    type="text"
                    id="q"
                    name="q"
                    className="input"
                    placeholder="Search product or brand..."
                    value={filters.q}
                    onChange={handleChange}
                />
            </div>
        </div>
    );
};

export default Filters;
