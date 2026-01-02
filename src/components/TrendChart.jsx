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

  // Filter out null values and their corresponding dates for display
  const validIndices = trend.iop_od.map((v, i) => (v !== null || trend.iop_os[i] !== null) ? i : -1).filter(i => i !== -1);
  
  // If no valid measurements with IOP data
  if (validIndices.length === 0) {
    return <EmptyState message="No IOP measurements recorded yet" icon="📊" />;
  }

  // Get only valid data points
  const validDates = validIndices.map(i => trend.dates[i]);
  const validOD = validIndices.map(i => trend.iop_od[i]);
  const validOS = validIndices.map(i => trend.iop_os[i]);

  // Calculate max values for scaling - include upper_cap for proper scaling
  const maxOD = Math.max(...validOD.filter(v => v !== null), 0);
  const maxOS = Math.max(...validOS.filter(v => v !== null), 0);
  const upperCapOD = trend.upper_cap_od || null;  // Only use if actually set
  const upperCapOS = trend.upper_cap_os || null;
  
  // Find the highest value we need to display (data, target, or cap)
  const highestValue = Math.max(maxOD, maxOS, trend.target_od || 0, trend.target_os || 0, upperCapOD || 0, upperCapOS || 0, 20);
  // Round up to nearest 5 for clean axis
  const maxValue = Math.ceil(highestValue * 1.15 / 5) * 5;

  const chartHeight = 200; // Must match CSS .single-bar-wrapper height

  // Single eye chart component - enhanced with upper cap line
  const EyeChart = ({ eyeType, data, dates, target, calculatedTarget, upperCap, isOverridden, glaucomaStage, color, label }) => {
    const validData = data.filter(v => v !== null);
    const latestValue = validData.length > 0 ? validData[validData.length - 1] : null;
    const minValue = validData.length > 0 ? Math.min(...validData) : null;
    const maxValueStat = validData.length > 0 ? Math.max(...validData) : null;
    const avgValue = validData.length > 0 
      ? (validData.reduce((a, b) => a + b, 0) / validData.length).toFixed(1) 
      : null;

    // Display target (final value that doctor approved/overrode)
    const displayTarget = target;
    // Upper cap from glaucoma stage - only show if target is set
    const displayUpperCap = target ? upperCap : null;
    
    // Determine status for styling
    const hasTarget = displayTarget !== null && displayTarget !== undefined;
    const isAboveCap = hasTarget && displayUpperCap && latestValue > displayUpperCap;
    const isAboveTarget = hasTarget && latestValue > displayTarget;

    return (
      <div className={`eye-chart ${eyeType}`}>
        <div className="chart-header">
          <h4>
            <span className="eye-icon">{eyeType === 'od' ? '🔵' : '🟢'}</span>
            {label}
          </h4>
          {hasTarget ? (
            <div className="chart-badges">
              <span className={`target-badge ${isOverridden ? 'overridden' : ''}`}>
                Target: {displayTarget} mmHg
              </span>
              {displayUpperCap && (
                <span className="upper-cap-badge">
                  Cap: ≤{displayUpperCap} mmHg
                </span>
              )}
            </div>
          ) : (
            <div className="chart-badges">
              <span className="no-target-badge">No target set - Calculate Target IOP</span>
            </div>
          )}
        </div>

        {/* Glaucoma Stage Indicator */}
        {glaucomaStage && (
          <div className={`stage-indicator stage-${glaucomaStage.toLowerCase().replace('_', '-')}`}>
            Stage: {glaucomaStage.replace('_', ' ')}
          </div>
        )}

        <div className="chart-area">
          {/* Y-axis */}
          <div className="y-axis">
            <div className="y-label">{maxValue}</div>
            <div className="y-label">{Math.round(maxValue * 0.8)}</div>
            <div className="y-label">{Math.round(maxValue * 0.6)}</div>
            <div className="y-label">{Math.round(maxValue * 0.4)}</div>
            <div className="y-label">{Math.round(maxValue * 0.2)}</div>
            <div className="y-label">0</div>
          </div>

          {/* Bars container */}
          <div className="single-bars-container">
            {data.map((value, idx) => {
              // Calculate bar height in pixels
              const barHeight = value !== null ? (value / maxValue) * chartHeight : 0;
              const isAboveTarget = displayTarget && value !== null && value > displayTarget;
              const isAboveUpperCap = displayUpperCap && value !== null && value > displayUpperCap;
              
              // Format date for display
              const dateObj = new Date(dates[idx]);
              const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              
              return (
                <div key={idx} className="single-bar-wrapper">
                  <div
                    className={`single-bar ${eyeType} ${hasTarget && displayUpperCap && value > displayUpperCap ? 'above-cap' : hasTarget && value > displayTarget ? 'above-target' : ''} ${value === null ? 'no-data' : ''}`}
                    style={{ height: value !== null ? `${barHeight}px` : '0px' }}
                    title={value !== null ? `${value} mmHg on ${dateStr}${hasTarget && displayUpperCap && value > displayUpperCap ? ' (Above Cap!)' : hasTarget && value > displayTarget ? ' (Above Target)' : ''}` : 'No data'}
                  >
                    {value !== null && <span className="bar-value">{value}</span>}
                  </div>
                  <div className="x-label">{dateStr}</div>
                </div>
              );
            })}

            {/* Upper Cap line (from glaucoma stage) - only show if target is set */}
            {hasTarget && displayUpperCap && (
              <div 
                className="upper-cap-line"
                style={{ bottom: `${(displayUpperCap / maxValue) * chartHeight + 28}px` }}
              >
                <span className="upper-cap-label">Cap ≤{displayUpperCap}</span>
              </div>
            )}

            {/* Target line - only show if target is set */}
            {hasTarget && displayTarget && (
              <div 
                className={`target-line ${eyeType} ${isOverridden ? 'overridden' : ''}`}
                style={{ bottom: `${(displayTarget / maxValue) * chartHeight + 28}px` }}
              >
                <span className="target-label">{displayTarget}</span>
              </div>
            )}

            {/* Calculated target line (if different from final) */}
            {calculatedTarget && isOverridden && calculatedTarget !== displayTarget && (
              <div 
                className="calculated-target-line"
                style={{ bottom: `${(calculatedTarget / maxValue) * chartHeight + 28}px` }}
              >
                <span className="calculated-label">Calc: {calculatedTarget}</span>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="eye-stats">
          <div className="stat-item">
            <span className="stat-label">LATEST</span>
            <span className={`stat-value ${hasTarget && latestValue && latestValue > displayTarget ? 'above' : 'within'}`}>
              {latestValue !== null ? `${latestValue} mmHg` : 'N/A'}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">MIN</span>
            <span className="stat-value">{minValue !== null ? `${minValue} mmHg` : 'N/A'}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">MAX</span>
            <span className="stat-value">{maxValueStat !== null ? `${maxValueStat} mmHg` : 'N/A'}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">AVG</span>
            <span className="stat-value">{avgValue !== null ? `${avgValue} mmHg` : 'N/A'}</span>
          </div>
        </div>
      </div>
    );
  };

  // Count only measurements with valid IOP data
  const validMeasurementCount = validIndices.length;

  return (
    <div className="trend-chart-container">
      <div className="trend-header">
        <h3>📈 IOP Trend Analysis</h3>
        <span className="measurement-count">{validMeasurementCount} Measurements with IOP data</span>
      </div>

      <div className="charts-grid">
        <EyeChart
          eyeType="od"
          data={validOD}
          dates={validDates}
          target={trend.target_od}
          calculatedTarget={trend.calculated_target_od}
          upperCap={trend.upper_cap_od}
          isOverridden={trend.is_overridden_od}
          glaucomaStage={trend.glaucoma_stage_od}
          color="#3b82f6"
          label="Right Eye (OD)"
        />
        <EyeChart
          eyeType="os"
          data={validOS}
          dates={validDates}
          target={trend.target_os}
          calculatedTarget={trend.calculated_target_os}
          upperCap={trend.upper_cap_os}
          isOverridden={trend.is_overridden_os}
          glaucomaStage={trend.glaucoma_stage_os}
          color="#10b981"
          label="Left Eye (OS)"
        />
      </div>

      {/* Legend */}
      <div className="chart-legend">
        <div className="legend-item">
          <span className="legend-line target"></span>
          <span>Target IOP</span>
        </div>
        <div className="legend-item">
          <span className="legend-line upper-cap"></span>
          <span>Upper Cap (from Glaucoma Stage)</span>
        </div>
        {(trend.is_overridden_od || trend.is_overridden_os) && (
          <div className="legend-item">
            <span className="legend-line calculated"></span>
            <span>Original Calculated Target</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default TrendChart;
