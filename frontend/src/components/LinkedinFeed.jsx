
import React, { useState } from 'react';

const MOCK_DATA = [
    {
        id: 1,
        brand: 'SYPS',
        product: 'Wild Cherry SKU',
        manufacturer: 'SYPS Drinks Ltd',
        manufacturerUrl: 'https://sypsdrinks.com',
        date: 'UNKNOWN', // Matches design
        retailer: 'Holland & Barrett',
        managingDirector: 'Roman Rozenson',
        marketingDirector: 'Roman Rozenson',
        postSnippet: '"Challenger brand SYPS has launched its third SKU (Wild Cherry) into 700 Holland & Barrett stores."',
        dealtWith: false,
        postUrl: '#'
    },
    {
        id: 2,
        brand: 'XOXO SODA',
        product: 'Soda',
        manufacturer: 'XOXO Soda Co',
        manufacturerUrl: 'https://xoxosoda.com',
        date: 'UNKNOWN',
        retailer: 'Boots',
        managingDirector: 'Rory Hoddell',
        marketingDirector: 'Shaf Junejo',
        postSnippet: '"Prebiotic soda brand XOXO has officially launched in Boots UK stores."',
        dealtWith: false,
        postUrl: '#'
    }
];

const LinkedinFeed = () => {
    const [items, setItems] = useState(MOCK_DATA);

    const toggleDealtWith = (id) => {
        setItems(items.map(item =>
            item.id === id ? { ...item, dealtWith: !item.dealtWith } : item
        ));
    };

    return (
        <div className="linkedin-feed">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '2rem' }}>
                {items.map(item => (
                    <div key={item.id} className="card" style={{ opacity: item.dealtWith ? 0.6 : 1, transition: 'opacity 0.2s' }}>
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <span className="badge badge-retailer" style={{ textTransform: 'uppercase' }}>{item.retailer}</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    📅 {item.date}
                                </span>
                            </div>
                            <button
                                className="btn btn-outline btn-sm"
                                onClick={() => toggleDealtWith(item.id)}
                                style={{ fontSize: '0.7rem', padding: '4px 8px', textTransform: 'uppercase' }}
                            >
                                {item.dealtWith ? 'Undo' : 'Mark Dealt With'}
                            </button>
                        </div>

                        {/* Brand / Product */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {item.brand}
                            </div>
                            <h3 style={{ margin: '0.25rem 0', fontSize: '1.25rem', fontWeight: 'bold' }}>
                                {item.product}
                            </h3>
                            {/* Manufacturer Link */}
                            <div style={{ marginTop: '0.25rem' }}>
                                <a href={item.manufacturerUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    🏭 {item.manufacturer} ↗
                                </a>
                            </div>
                        </div>

                        {/* People Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <div style={{ fontSize: '0.65rem', fontWeight: '700', color: 'var(--color-turquoise)', textTransform: 'uppercase', marginBottom: '4px' }}>
                                    Managing Dir
                                </div>
                                <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{item.managingDirector || 'Unknown'}</div>
                            </div>
                            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <div style={{ fontSize: '0.65rem', fontWeight: '700', color: 'var(--color-accent)', textTransform: 'uppercase', marginBottom: '4px' }}>
                                    Marketing Dir
                                </div>
                                <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{item.marketingDirector || 'Unknown'}</div>
                            </div>
                        </div>

                        {/* Quote */}
                        <div style={{
                            background: '#f8fafc',
                            padding: '1rem',
                            borderRadius: '0 8px 8px 0',
                            borderLeft: '4px solid var(--color-turquoise)',
                            marginBottom: '1.5rem',
                            fontStyle: 'italic',
                            color: 'var(--color-text-secondary)'
                        }}>
                            {item.postSnippet}
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <button className="btn" style={{ width: '100%', background: 'var(--color-slate)', color: 'white' }}>
                                OUTREACH LAB
                            </button>
                            <a href={item.postUrl} target="_blank" rel="noopener noreferrer"
                                style={{ textAlign: 'center', fontSize: '0.8rem', fontWeight: 'bold', color: '#94a3b8', textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                View Linkedin Post
                            </a>
                        </div>

                    </div>
                ))}
            </div>
        </div>
    );
};

export default LinkedinFeed;
