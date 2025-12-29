import React from 'react';
import { useTrendData } from '../hooks';
import { LoadingSpinner, EmptyState } from './Common';
import '../styles/TrendChart.css';

function TrendChart({ patientId }) {
  const { trend, loading, error } = useTrendData(patientId);

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="error-message">Error: {error}</div>;
  if (!trend || trend.total_measurements === 0) {
    return <EmptyState message="No measurement data available" icon="📊" />;
  }

  // Simple chart using CSS bars (for MVP)
  const maxIOP = Math.max(
    ...trend.iop_od.filter(v => v !== null),
    ...trend.iop_os.filter(v => v !== null)
  );

  const chartHeight = 300;
  const maxValue = Math.ceil(maxIOP * 1.2);

  return (
    <div className="trend-chart">
      <h3>📈 IOP Trend (Last {trend.total_measurements} Measurements)</h3>
      
      <div className="chart-container">
        <div className="chart-legend">
          <div className="legend-item">
            <span className="color-od">■</span> Right Eye (OD)
          </div>
          <div className="legend-item">
            <span className="color-os">■</span> Left Eye (OS)
          </div>
          {trend.target_od && (
            <div className="legend-item">
              <span className="color-target">- - -</span> Target OD: {trend.target_od}
            </div>
          )}
          {trend.target_os && (
            <div className="legend-item">
              <span className="color-target">- - -</span> Target OS: {trend.target_os}
            </div>
          )}
        </div>

        <div className="chart">
          {/* Y-axis labels */}
          <div className="y-axis">
            <div className="y-label">{maxValue}</div>
            <div className="y-label">{Math.round(maxValue * 0.75)}</div>
            <div className="y-label">{Math.round(maxValue * 0.5)}</div>
            <div className="y-label">{Math.round(maxValue * 0.25)}</div>
            <div className="y-label">0</div>
          </div>

          {/* Chart bars */}
          <div className="bars-container">
            {trend.iop_od.map((od, idx) => {
              const os = trend.iop_os[idx];
              const odHeight = od ? (od / maxValue) * 100 : 0;
              const osHeight = os ? (os / maxValue) * 100 : 0;

              return (
                <div key={idx} className="bar-group">
                  {od && (
                    <div
                      className="bar bar-od"
                      style={{ height: `${odHeight}%` }}
                      title={`OD: ${od} mmHg`}
                    >
                      <span className="bar-value">{od}</span>
                    </div>
                  )}
                  {os && (
                    <div
                      className="bar bar-os"
                      style={{ height: `${osHeight}%` }}
                      title={`OS: ${os} mmHg`}
                    >
                      <span className="bar-value">{os}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Target lines */}
          {trend.target_od && (
            <div 
              className="target-line target-od"
              style={{ top: `${100 - (trend.target_od / maxValue) * 100}%` }}
              title={`Target OD: ${trend.target_od}`}
            />
          )}
          {trend.target_os && (
            <div 
              className="target-line target-os"
              style={{ top: `${100 - (trend.target_os / maxValue) * 100}%` }}
              title={`Target OS: ${trend.target_os}`}
            />
          )}
        </div>
      </div>

      {/* X-axis dates */}
      <div className="x-axis">
        {trend.dates.map((date, idx) => (
          <div key={idx} className="x-label">
            {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="trend-summary">
        <div className="summary-item">
          <span>Latest OD:</span>
          <strong>{trend.iop_od[trend.iop_od.length - 1]}</strong> mmHg
        </div>
        <div className="summary-item">
          <span>Latest OS:</span>
          <strong>{trend.iop_os[trend.iop_os.length - 1]}</strong> mmHg
        </div>
        <div className="summary-item">
          <span>Target OD:</span>
          <strong>{trend.target_od}</strong> mmHg
        </div>
        <div className="summary-item">
          <span>Target OS:</span>
          <strong>{trend.target_os}</strong> mmHg
        </div>
      </div>
    </div>
  );
}

export default TrendChart;
