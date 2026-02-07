import React from 'react';

const ResultsTable = ({ data, loading }) => {
    if (loading) {
        return <div className="card empty-state">Loading results...</div>;
    }

    if (!data || data.length === 0) {
        return <div className="card empty-state">No products found matching your criteria.</div>;
    }

    return (
        <div className="card table-container">
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Retailer</th>
                        <th>Brand</th>
                        <th>Product</th>
                        <th>Price</th>
                        <th>Rating</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((item, index) => (
                        <tr key={`${item.product_url}-${index}`}>
                            <td>{item.date_found}</td>
                            <td>
                                <span className="badge badge-retailer">{item.retailer}</span>
                            </td>
                            <td>{item.brand}</td>
                            <td>
                                {item.product_url ? (
                                    <a href={item.product_url} target="_blank" rel="noopener noreferrer" className="product-link">
                                        {item.product_name}
                                    </a>
                                ) : (
                                    item.product_name
                                )}
                            </td>
                            <td className="price">{item.price_display}</td>
                            <td>
                                <div className="rating">
                                    <span>★</span>
                                    <span>{item.rating || '-'}</span>
                                    <span style={{ color: '#9ca3af', fontSize: '0.8em' }}>({item.reviews || 0})</span>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default ResultsTable;
