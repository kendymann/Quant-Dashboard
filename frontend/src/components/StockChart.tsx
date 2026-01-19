"use client";
import { 
    createChart, 
    ColorType, 
    CandlestickSeries,
    LineSeries,
    AreaSeries,
    Time,
    ISeriesApi,
    IChartApi
} from 'lightweight-charts';
import React, { useEffect, useRef, useState } from 'react';

interface StockChartProps {
    data: any[];
    spyData: any[];
    selectedTimeframe: string;
    showPrice: boolean;
    showSMA: boolean;
    showBollinger: boolean;
    showSPY: boolean;
    onTogglePrice: () => void;
    onToggleSMA: () => void;
    onToggleBollinger: () => void;
    onToggleSPY: () => void;
}

// Percentage Normalization (0% Baseline)
// Formula: ((currentPrice / firstVisiblePrice) - 1) * 100
const normalizeToPercentage = (
    prices: { time: Time; value: number }[], 
    basePrice: number
): { time: Time; value: number }[] => {
    return prices.map(p => ({
        time: p.time,
        value: ((p.value / basePrice) - 1) * 100
    }));
};

// Version: 2.0 - Timeframe-based normalization
export const StockChart = ({ 
    data, 
    spyData,
    selectedTimeframe,
    showPrice,
    showSMA,
    showBollinger,
    showSPY,
    onTogglePrice,
    onToggleSMA,
    onToggleBollinger,
    onToggleSPY
}: StockChartProps) => {
    const mainChartRef = useRef<HTMLDivElement>(null);
    const rsiChartRef = useRef<HTMLDivElement>(null);
    const mainChartInstanceRef = useRef<IChartApi | null>(null);
    const rsiChartInstanceRef = useRef<ReturnType<typeof createChart> | null>(null);
    
    // Series refs for visibility toggling
    const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
    const priceLineSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const smaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const bollingerAreaRef = useRef<ISeriesApi<"Area"> | null>(null);
    const upperBandRef = useRef<ISeriesApi<"Line"> | null>(null);
    const lowerBandRef = useRef<ISeriesApi<"Line"> | null>(null);
    const spySeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const baselineRef = useRef<ISeriesApi<"Line"> | null>(null);
    
    // Store formatted data for re-basing
    const formattedDataRef = useRef<any[]>([]);
    const spyPriceMapRef = useRef<Map<string, number>>(new Map());
    
    // Current RSI value for display
    const [currentRSI, setCurrentRSI] = useState<number | null>(null);
    
    // Alpha calculation (Ticker % - SPY %)
    const [tickerReturn, setTickerReturn] = useState<number>(0);
    const [spyReturn, setSpyReturn] = useState<number>(0);
    const alpha = tickerReturn - spyReturn;

    // Toggle visibility effects (only when NOT in SPY comparison mode)
    useEffect(() => {
        if (!showSPY && candlestickSeriesRef.current) {
            candlestickSeriesRef.current.applyOptions({ visible: showPrice });
        }
    }, [showPrice, showSPY]);

    useEffect(() => {
        if (!showSPY && smaSeriesRef.current) {
            smaSeriesRef.current.applyOptions({ visible: showSMA });
        }
    }, [showSMA, showSPY]);

    useEffect(() => {
        if (!showSPY) {
            if (bollingerAreaRef.current) {
                bollingerAreaRef.current.applyOptions({ visible: showBollinger });
            }
            if (upperBandRef.current) {
                upperBandRef.current.applyOptions({ visible: showBollinger });
            }
            if (lowerBandRef.current) {
                lowerBandRef.current.applyOptions({ visible: showBollinger });
            }
        }
    }, [showBollinger, showSPY]);

    useEffect(() => {
        // Early return if refs or data are invalid
        if (!mainChartRef.current || !rsiChartRef.current || !data || !Array.isArray(data) || data.length === 0) {
            return;
        }

        // Main Price Chart - transparent background
        const mainChart = createChart(mainChartRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: '#FFFFFF',
                fontFamily: 'Space Mono, monospace',
            },
            width: mainChartRef.current.clientWidth,
            height: 400,
            grid: {
                vertLines: { visible: false },
                horzLines: { visible: false },
            },
            rightPriceScale: {
                borderColor: '#27272a',
                borderVisible: false,
            },
            timeScale: {
                borderColor: '#27272a',
                borderVisible: false,
            },
            crosshair: {
                vertLine: {
                    color: 'rgba(255, 255, 255, 0.2)',
                    width: 1,
                    style: 2,
                    labelBackgroundColor: '#18181b',
                },
                horzLine: {
                    color: 'rgba(255, 255, 255, 0.2)',
                    width: 1,
                    style: 2,
                    labelBackgroundColor: '#18181b',
                },
            },
        });
        mainChartInstanceRef.current = mainChart;

        // RSI Sub-Chart - transparent background with locked 0-100 scale
        const rsiChart = createChart(rsiChartRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: '#FFFFFF',
                fontFamily: 'Space Mono, monospace',
            },
            width: rsiChartRef.current.clientWidth,
            height: 133,
            grid: {
                vertLines: { visible: false },
                horzLines: { visible: false },
            },
            rightPriceScale: {
                borderColor: '#27272a',
                borderVisible: false,
                scaleMargins: {
                    top: 0.05,
                    bottom: 0.05,
                },
                autoScale: false,
            },
            timeScale: {
                borderColor: '#27272a',
                borderVisible: false,
                timeVisible: true,
                secondsVisible: false,
            },
            crosshair: {
                vertLine: {
                    color: 'rgba(255, 255, 255, 0.2)',
                    width: 1,
                    style: 2,
                    labelBackgroundColor: '#18181b',
                },
                horzLine: {
                    color: 'rgba(255, 255, 255, 0.2)',
                    width: 1,
                    style: 2,
                    labelBackgroundColor: '#18181b',
                },
            },
        });
        rsiChartInstanceRef.current = rsiChart;

        // Synchronize time scales
        const mainTimeScale = mainChart.timeScale();
        const rsiTimeScale = rsiChart.timeScale();

        const mainTimeScaleHandler = () => {
            if (mainChart && rsiChart) {
                const timeRange = mainChart.timeScale().getVisibleRange();
                if (timeRange) {
                    try {
                        rsiChart.timeScale().setVisibleRange(timeRange);
                    } catch (e) {
                        // Silently handle race condition errors
                    }
                }
            }
        };

        const rsiTimeScaleHandler = () => {
            if (mainChart && rsiChart) {
                const timeRange = rsiChart.timeScale().getVisibleRange();
                if (timeRange) {
                    try {
                        mainChart.timeScale().setVisibleRange(timeRange);
                    } catch (e) {
                        // Silently handle race condition errors
                    }
                }
            }
        };

        mainTimeScale.subscribeVisibleTimeRangeChange(mainTimeScaleHandler);
        rsiTimeScale.subscribeVisibleTimeRangeChange(rsiTimeScaleHandler);

        // Prepare and validate data
        const validData = data.filter(d => d.time && d.close !== null);
        
        // Format time correctly (YYYY-MM-DD format)
        const formattedData = validData.map(d => {
            const dateStr = d.time;
            const time = dateStr.includes('T') ? (dateStr.split('T')[0] as Time) : (dateStr as Time);
            return {
                time,
                open: d.open,
                high: d.high,
                low: d.low,
                close: d.close,
                sma_20: d.sma_20,
                bollinger_upper: d.bollinger_upper,
                bollinger_lower: d.bollinger_lower,
                rsi_14: d.rsi_14,
            };
        });
        formattedDataRef.current = formattedData;

        // Build SPY price map
        const spyPriceMap = new Map<string, number>();
        if (spyData && spyData.length > 0) {
            spyData.forEach(d => {
                const dateStr = d.time.includes('T') ? d.time.split('T')[0] : d.time;
                if (d.close !== null) {
                    spyPriceMap.set(dateStr, d.close);
                }
            });
        }
        spyPriceMapRef.current = spyPriceMap;

        // Calculate timeframe start date for normalization base
        const getTimeframeStartDate = (timeframe: string): string => {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            let startDate: Date;

            switch (timeframe) {
                case '1M':
                    startDate = new Date(today);
                    startDate.setMonth(startDate.getMonth() - 1);
                    break;
                case '3M':
                    startDate = new Date(today);
                    startDate.setMonth(startDate.getMonth() - 3);
                    break;
                case '1Y':
                    startDate = new Date(today);
                    startDate.setFullYear(startDate.getFullYear() - 1);
                    break;
                case 'YTD':
                    startDate = new Date(today.getFullYear(), 0, 1);
                    break;
                case 'ALL':
                default:
                    return formattedData[0]?.time as string || '';
            }
            return startDate.toISOString().split('T')[0];
        };

        // Find first data point for the selected timeframe
        const timeframeStartStr = getTimeframeStartDate(selectedTimeframe);
        const timeframeFirstDataIndex = formattedData.findIndex(d => {
            const dataDate = typeof d.time === 'string' ? d.time : String(d.time);
            return dataDate >= timeframeStartStr;
        });
        const timeframeBaseIndex = timeframeFirstDataIndex >= 0 ? timeframeFirstDataIndex : 0;
        
        // Debug: log to verify timeframe normalization
        console.log('[StockChart v2.0] Timeframe:', selectedTimeframe, 
            '| Start:', timeframeStartStr, 
            '| Base Index:', timeframeBaseIndex,
            '| Base Price:', formattedData[timeframeBaseIndex]?.close);

        if (showSPY) {
            // ═══════════════════════════════════════════════════════════════════
            // COMPARISON MODE: Percentage Normalization (0% Baseline)
            // ═══════════════════════════════════════════════════════════════════
            
            const priceData = formattedData.map(d => ({ 
                time: d.time, 
                value: d.close! 
            }));
            
            // Get first price based on SELECTED TIMEFRAME, not full data
            const basePrice = formattedData[timeframeBaseIndex]?.close || priceData[0]?.value || 1;
            const normalizedPriceData = normalizeToPercentage(priceData, basePrice);
            
            // Set initial ticker return (from timeframe start to end)
            const lastTickerReturn = normalizedPriceData[normalizedPriceData.length - 1]?.value || 0;
            setTickerReturn(lastTickerReturn);
            
            // Main ticker line (percentage) with custom formatter
            const priceLine = mainChart.addSeries(LineSeries, {
                color: '#FFFFFF',
                lineWidth: 2,
                priceLineVisible: true,
                lastValueVisible: true,
                priceFormat: {
                    type: 'custom',
                    formatter: (price: number) => {
                        const sign = price >= 0 ? '+' : '';
                        return `${sign}${price.toFixed(1)}%`;
                    },
                },
            });
            priceLine.setData(normalizedPriceData);
            priceLineSeriesRef.current = priceLine;

            // SPY Benchmark line (percentage)
            if (spyPriceMap.size > 0) {
                // Use the same timeframe base for SPY normalization
                const firstSpyPrice = spyPriceMap.get(formattedData[timeframeBaseIndex].time as string);
                
                if (firstSpyPrice) {
                    const spyLineData = formattedData
                        .map(d => {
                            const spyPrice = spyPriceMap.get(d.time as string);
                            if (spyPrice) {
                                return { time: d.time, value: spyPrice };
                            }
                            return null;
                        })
                        .filter((d): d is { time: Time; value: number } => d !== null);

                    const normalizedSpyData = normalizeToPercentage(spyLineData, firstSpyPrice);
                    
                    // Set initial SPY return
                    const lastSpyReturn = normalizedSpyData[normalizedSpyData.length - 1]?.value || 0;
                    setSpyReturn(lastSpyReturn);

                    const spySeries = mainChart.addSeries(LineSeries, {
                        color: 'rgba(255, 255, 255, 0.4)',
                        lineWidth: 1,
                        lineStyle: 2, // Dashed
                        priceLineVisible: false,
                        lastValueVisible: true,
                        title: 'SPY',
                        priceFormat: {
                            type: 'custom',
                            formatter: (price: number) => {
                                const sign = price >= 0 ? '+' : '';
                                return `${sign}${price.toFixed(1)}%`;
                            },
                        },
                    });
                    spySeries.setData(normalizedSpyData);
                    spySeriesRef.current = spySeries;
                }
            }

            // Baseline at 0% (Break-even line)
            const baselineData = formattedData.map(d => ({ time: d.time, value: 0 }));
            const baseline = mainChart.addSeries(LineSeries, {
                color: 'rgba(39, 39, 42, 1)', // zinc-800
                lineWidth: 1,
                lineStyle: 2, // Dashed
                priceLineVisible: false,
                lastValueVisible: false,
                crosshairMarkerVisible: false,
            });
            baseline.setData(baselineData);
            baselineRef.current = baseline;

            // Note: Dynamic re-basing removed - timeframe buttons handle normalization

        } else {
            // ═══════════════════════════════════════════════════════════════════
            // ABSOLUTE MODE: Dollar prices with SMA and Bollinger Bands
            // ═══════════════════════════════════════════════════════════════════
            
            // Candlestick Series - clinical monochrome
            const candlestickSeries = mainChart.addSeries(CandlestickSeries, {
                upColor: '#FFFFFF',
                downColor: '#FFFFFF',
                borderVisible: false,
                wickUpColor: '#FFFFFF',
                wickDownColor: '#FFFFFF',
                visible: showPrice,
                priceFormat: {
                    type: 'price',
                    precision: 2,
                    minMove: 0.01,
                },
            });
            candlestickSeries.setData(formattedData.map(d => ({
                time: d.time,
                open: d.open!,
                high: d.high!,
                low: d.low!,
                close: d.close!,
            })));
            candlestickSeriesRef.current = candlestickSeries;

            // Bollinger Bands data
            const bollingerUpperData = formattedData
                .filter(d => d.bollinger_upper !== null && d.bollinger_lower !== null)
                .map(d => ({ time: d.time, value: d.bollinger_upper! }));
            
            const bollingerLowerData = formattedData
                .filter(d => d.bollinger_upper !== null && d.bollinger_lower !== null)
                .map(d => ({ time: d.time, value: d.bollinger_lower! }));

            // Bollinger Bands - International Orange borders with ghost fill
            const bollingerArea = mainChart.addSeries(AreaSeries, {
                lineColor: 'rgba(255, 69, 0, 0.4)',
                topColor: 'rgba(255, 255, 255, 0.03)',
                bottomColor: 'rgba(255, 255, 255, 0.03)',
                priceLineVisible: false,
                lastValueVisible: false,
                visible: showBollinger,
            });
            bollingerArea.setData(bollingerLowerData);
            bollingerAreaRef.current = bollingerArea;

            // Upper band line - International Orange (#ff4500)
            const upperBandLine = mainChart.addSeries(LineSeries, {
                color: '#ff4500',
                lineWidth: 1,
                priceLineVisible: false,
                lastValueVisible: false,
                visible: showBollinger,
            });
            upperBandLine.setData(bollingerUpperData);
            upperBandRef.current = upperBandLine;

            // Lower band line - International Orange (#ff4500)
            const lowerBandLine = mainChart.addSeries(LineSeries, {
                color: '#ff4500',
                lineWidth: 1,
                priceLineVisible: false,
                lastValueVisible: false,
                visible: showBollinger,
            });
            lowerBandLine.setData(bollingerLowerData);
            lowerBandRef.current = lowerBandLine;

            // 20-day SMA Line - Electric Cyan (#00d4ff)
            const smaData = formattedData
                .filter(d => d.sma_20 !== null)
                .map(d => ({ time: d.time, value: d.sma_20! }));
            
            const smaSeries = mainChart.addSeries(LineSeries, {
                color: '#00d4ff',
                lineWidth: 1,
                priceLineVisible: false,
                lastValueVisible: false,
                visible: showSMA,
            });
            smaSeries.setData(smaData);
            smaSeriesRef.current = smaSeries;
        }

        // RSI Line (always shown)
        const rsiData = formattedData
            .filter(d => d.rsi_14 !== null)
            .map(d => ({ time: d.time, value: d.rsi_14! }));

        const rsiSeries = rsiChart.addSeries(LineSeries, {
            color: '#FFFFFF',
            lineWidth: 1,
            priceLineVisible: true,
            lastValueVisible: true,
            priceFormat: {
                type: 'price',
                precision: 1,
                minMove: 0.1,
            },
        });
        rsiSeries.setData(rsiData);

        // Set current RSI for display
        if (rsiData.length > 0) {
            setCurrentRSI(rsiData[rsiData.length - 1].value);
        }

        // Lock RSI Y-axis to 0-100 range
        rsiChart.priceScale('right').applyOptions({
            autoScale: false,
            scaleMargins: {
                top: 0.05,
                bottom: 0.05,
            },
        });

        // RSI reference lines (30, 50, 70) on rsiSeries
        [30, 50, 70].forEach(level => {
            rsiSeries.createPriceLine({
                price: level,
                color: level === 50 ? 'rgba(113, 113, 122, 0.2)' : 'rgba(113, 113, 122, 0.4)',
                lineWidth: 1,
                lineStyle: 2,
                axisLabelVisible: true,
                title: '',
            });
        });

        // Fit content
        mainChart.timeScale().fitContent();
        rsiChart.timeScale().fitContent();

        // Timeframe logic
        const setTimeframeRange = (timeframe: string) => {
            if (!formattedData || formattedData.length === 0) return;

            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            let startDate: Date;

            switch (timeframe) {
                case '1M':
                    startDate = new Date(today);
                    startDate.setMonth(startDate.getMonth() - 1);
                    break;
                case '3M':
                    startDate = new Date(today);
                    startDate.setMonth(startDate.getMonth() - 3);
                    break;
                case '1Y':
                    startDate = new Date(today);
                    startDate.setFullYear(startDate.getFullYear() - 1);
                    break;
                case 'YTD':
                    startDate = new Date(today.getFullYear(), 0, 1);
                    break;
                case 'ALL':
                default:
                    // Use fitContent() for ALL to show full 1341+ day history
                    mainChart.timeScale().fitContent();
                    rsiChart.timeScale().fitContent();
                    return;
            }

            const startDateStr = startDate.toISOString().split('T')[0];

            const startTime = formattedData.find(d => {
                const dataDate = typeof d.time === 'string' ? d.time : String(d.time);
                return dataDate >= startDateStr;
            })?.time;

            const endTime = formattedData[formattedData.length - 1]?.time;

            if (startTime && endTime) {
                try {
                    mainChart.timeScale().setVisibleRange({ from: startTime as Time, to: endTime as Time });
                    rsiChart.timeScale().setVisibleRange({ from: startTime as Time, to: endTime as Time });
                } catch (e) {
                    mainChart.timeScale().fitContent();
                    rsiChart.timeScale().fitContent();
                }
            }
        };

        if (selectedTimeframe) {
            setTimeframeRange(selectedTimeframe);
        }

        // Resize handler
        const handleResize = () => {
            if (mainChartRef.current && mainChart) {
                mainChart.applyOptions({ width: mainChartRef.current.clientWidth });
            }
            if (rsiChartRef.current && rsiChart) {
                rsiChart.applyOptions({ width: rsiChartRef.current.clientWidth });
            }
        };

        window.addEventListener('resize', handleResize);

        // Cleanup
        return () => {
            window.removeEventListener('resize', handleResize);
            
            if (mainTimeScale) {
                mainTimeScale.unsubscribeVisibleTimeRangeChange(mainTimeScaleHandler);
            }
            if (rsiTimeScale) {
                rsiTimeScale.unsubscribeVisibleTimeRangeChange(rsiTimeScaleHandler);
            }
            
            // Clear series refs
            candlestickSeriesRef.current = null;
            priceLineSeriesRef.current = null;
            smaSeriesRef.current = null;
            bollingerAreaRef.current = null;
            upperBandRef.current = null;
            lowerBandRef.current = null;
            spySeriesRef.current = null;
            baselineRef.current = null;
            
            if (mainChart) {
                mainChart.remove();
                mainChartInstanceRef.current = null;
            }
            if (rsiChart) {
                rsiChart.remove();
                rsiChartInstanceRef.current = null;
            }
        };
    }, [data, spyData, selectedTimeframe, showSPY]);

    // Format alpha with color
    const alphaFormatted = `${alpha >= 0 ? '+' : ''}${alpha.toFixed(1)}%`;
    const alphaColor = alpha >= 0 ? '#00ff41' : '#ff4500'; // Signal Green or International Orange

    return (
        <div className="chart-container">
            {/* Interactive Chart Legend - Toggle Controls */}
            <div className="chart-legend">
                {showSPY ? (
                    <>
                        {/* Comparison Mode Legend */}
                        <div 
                            className="chart-legend-item" 
                            style={{ 
                                color: tickerReturn >= 0 ? '#00ff41' : '#ff4500' 
                            }}
                        >
                            TICKER {tickerReturn >= 0 ? '+' : ''}{tickerReturn.toFixed(1)}%
                        </div>
                        <div 
                            className="chart-legend-item"
                            style={{ 
                                color: spyReturn >= 0 
                                    ? 'rgba(255, 255, 255, 0.84)' 
                                    : 'rgba(255, 69, 0, 0.4)' 
                            }}
                            onClick={onToggleSPY}
                        >
                            SPY [COMPARE] {spyReturn >= 0 ? '+' : ''}{spyReturn.toFixed(1)}%
                        </div>
                        <div 
                            className="chart-legend-item" 
                            style={{ color: 'rgb(237, 237, 243)' }}
                        >
                            0% BASELINE
                        </div>
                        {/* Alpha Highlight */}
                        <div 
                            className="chart-legend-item"
                            style={{ 
                                color: alphaColor,
                                fontWeight: 700,
                                marginLeft: 'auto'
                            }}
                        >
                            ALPHA: {alphaFormatted}
                        </div>
                    </>
                ) : (
                    <>
                        {/* Absolute Mode Legend */}
                        <div 
                            className={`chart-legend-item ${!showPrice ? 'disabled' : ''}`}
                            style={{ color: '#FFFFFF' }}
                            onClick={onTogglePrice}
                        >
                            PRICE
                        </div>
                        <div 
                            className={`chart-legend-item ${!showSMA ? 'disabled' : ''}`}
                            style={{ color: '#00d4ff' }}
                            onClick={onToggleSMA}
                        >
                            20-DAY SMA
                        </div>
                        <div 
                            className={`chart-legend-item ${!showBollinger ? 'disabled' : ''}`}
                            style={{ color: '#ff4500' }}
                            onClick={onToggleBollinger}
                        >
                            BOLLINGER ENVELOPE
                        </div>
                        {/* SPY Compare Toggle (in same legend row) */}
                        <div 
                            className="chart-legend-item disabled"
                            style={{ color: '#FFFFFF' }}
                            onClick={onToggleSPY}
                        >
                            SPY [COMPARE]
                        </div>
                    </>
                )}
            </div>
            
            {/* Main Price Chart */}
            <div 
                ref={mainChartRef}
                className="chart-main" 
                style={{ width: '100%', height: '400px', position: 'relative' }} 
            />
            
            {/* RSI Chart */}
            <div style={{ position: 'relative', marginTop: 'var(--space-sm)' }}>
                <div 
                    ref={rsiChartRef}
                    className="chart-rsi" 
                    style={{ width: '100%', height: '133px' }} 
                />                              
                {/* RSI Y-axis Label */}
                <div 
                    style={{ 
                        position: 'absolute',
                        left: '-48px',
                        top: '50%',
                        transform: 'translateY(-50%) rotate(-90deg)',
                        transformOrigin: 'center',
                        zIndex: 10,
                        pointerEvents: 'none'
                    }}
                >
                    <span className="label-micro" style={{ whiteSpace: 'nowrap' }}>
                        MOMENTUM_RSI
                    </span>
                </div>
            </div>
        </div>
    );
};
