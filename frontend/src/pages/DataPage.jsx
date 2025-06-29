// frontend/src/pages/DataPage.jsx - Full Updated dengan Toast & Skeleton
import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { publicAxios } from '../config';
import { showToast } from '../utils/toast';
import { TableSkeleton, StatsCardSkeleton } from '../components/LoadingSkeletons';

const DataPage = () => {
    // State untuk menyimpan data
    const [kecamatanData, setKecamatanData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [downloadLoading, setDownloadLoading] = useState(false);

    // State untuk filter dan pencarian
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCluster, setSelectedCluster] = useState('all');
    const [sortConfig, setSortConfig] = useState({
        key: null,
        direction: 'descending'
    });

    // Ambil data dari database saat komponen dimuat
    useEffect(() => {
        fetchData();
    }, []);

    // Fungsi untuk mengambil data dari database - menggunakan endpoint public
    const fetchData = async () => {
        const loadingToast = showToast.loading('Memuat data RTH...');

        try {
            setLoading(true);
            setError(null);

            // Gunakan endpoint public untuk halaman DataPage
            const response = await publicAxios.get('/api/rth-kecamatan/public');

            // Format data dari database untuk UI
            const formattedData = response.data.map((item, index) => ({
                id: item._id || `temp-id-${index}`,
                index: index + 1,
                kecamatan: item.kecamatan || 'Unnamed',
                luas_taman: parseFloat(item.luas_taman) || 0,
                luas_pemakaman: parseFloat(item.luas_pemakaman) || 0,
                total_rth: parseFloat(item.total_rth) || 0,
                luas_kecamatan: parseFloat(item.luas_kecamatan) || 0,
                cluster: item.cluster || 'undefined'
            }));

            setKecamatanData(formattedData);
            setFilteredData(formattedData);

            showToast.success(`${formattedData.length} data RTH berhasil dimuat`);
            setLoading(false);
        } catch (err) {
            console.error("Error fetching data:", err);

            // Specific error handling dengan toast
            if (err.response?.status === 404) {
                setError("Data RTH tidak ditemukan");
                showToast.error("Data RTH tidak ditemukan");
            } else if (err.response?.status >= 500) {
                setError("Server sedang bermasalah. Silakan coba lagi nanti.");
                showToast.error("Server bermasalah. Coba lagi nanti.");
            } else if (!navigator.onLine) {
                setError("Tidak ada koneksi internet");
                showToast.error("Periksa koneksi internet Anda");
            } else {
                setError("Gagal mengambil data: " + (err.response?.data?.message || err.message));
                showToast.error("Gagal memuat data. Silakan refresh halaman.");
            }

            setLoading(false);
            // Tetapkan array kosong sebagai fallback
            setKecamatanData([]);
            setFilteredData([]);
        }
    };

    // Effect untuk filter dan sort data ketika ada perubahan filter/search/sort
    useEffect(() => {
        try {
            let result = [...kecamatanData];

            // Filter berdasarkan cluster
            if (selectedCluster !== 'all') {
                result = result.filter(item => item.cluster === selectedCluster);
            }

            // Filter berdasarkan pencarian
            if (searchTerm) {
                const searchLower = searchTerm.toLowerCase();
                result = result.filter(item =>
                    (item.kecamatan || '').toLowerCase().includes(searchLower)
                );
            }

            // Pengurutan data
            if (sortConfig.key) {
                result.sort((a, b) => {
                    // Null check
                    if (a[sortConfig.key] === null || a[sortConfig.key] === undefined) return sortConfig.direction === 'ascending' ? -1 : 1;
                    if (b[sortConfig.key] === null || b[sortConfig.key] === undefined) return sortConfig.direction === 'ascending' ? 1 : -1;

                    // Numeric compare untuk field numerik
                    if (typeof a[sortConfig.key] === 'number' && typeof b[sortConfig.key] === 'number') {
                        return sortConfig.direction === 'ascending'
                            ? a[sortConfig.key] - b[sortConfig.key]
                            : b[sortConfig.key] - a[sortConfig.key];
                    }

                    // String compare untuk field text
                    return sortConfig.direction === 'ascending'
                        ? String(a[sortConfig.key]).localeCompare(String(b[sortConfig.key]))
                        : String(b[sortConfig.key]).localeCompare(String(a[sortConfig.key]));
                });
            }

            // Update filtered data
            setFilteredData(result);
        } catch (error) {
            console.error("Error filtering/sorting data:", error);
            // Fallback ke original data jika error
            setFilteredData([...kecamatanData]);
        }
    }, [kecamatanData, searchTerm, selectedCluster, sortConfig]);

    // Fungsi untuk download data ke Excel
    const downloadToExcel = () => {
        const loadingToast = showToast.loading('Memproses download...');

        try {
            setDownloadLoading(true);

            // Siapkan data untuk export (gunakan filtered data atau semua data tergantung pilihan)
            const dataToExport = filteredData.length > 0 ? filteredData : kecamatanData;

            if (dataToExport.length === 0) {
                showToast.error('Tidak ada data untuk didownload');
                setDownloadLoading(false);
                return;
            }

            // Format data untuk Excel
            const excelData = dataToExport.map((item, index) => ({
                'No': index + 1,
                'Kecamatan': item.kecamatan,
                'Luas Taman (ha)': parseFloat(item.luas_taman).toFixed(3),
                'Luas Pemakaman (ha)': parseFloat(item.luas_pemakaman).toFixed(3),
                'Total RTH (ha)': parseFloat(item.total_rth).toFixed(3),
                'Luas Kecamatan (ha)': parseFloat(item.luas_kecamatan).toFixed(0),
                'Persentase RTH (%)': item.luas_kecamatan > 0 ?
                    ((item.total_rth / item.luas_kecamatan) * 100).toFixed(2) : '0.00',
                'Cluster': item.cluster
            }));

            // Tambahkan baris total di akhir
            const totalRow = {
                'No': '',
                'Kecamatan': 'TOTAL',
                'Luas Taman (ha)': safeReduce(dataToExport, 'luas_taman').toFixed(3),
                'Luas Pemakaman (ha)': safeReduce(dataToExport, 'luas_pemakaman').toFixed(3),
                'Total RTH (ha)': safeReduce(dataToExport, 'total_rth').toFixed(3),
                'Luas Kecamatan (ha)': safeReduce(dataToExport, 'luas_kecamatan').toFixed(0),
                'Persentase RTH (%)': safeReduce(dataToExport, 'luas_kecamatan') > 0 ?
                    ((safeReduce(dataToExport, 'total_rth') / safeReduce(dataToExport, 'luas_kecamatan')) * 100).toFixed(2) : '0.00',
                'Cluster': ''
            };

            excelData.push(totalRow);

            // Buat workbook dan worksheet
            const workbook = XLSX.utils.book_new();
            const worksheet = XLSX.utils.json_to_sheet(excelData);

            // Set lebar kolom
            const columnWidths = [
                { wch: 5 },  // No
                { wch: 20 }, // Kecamatan
                { wch: 18 }, // Luas Taman
                { wch: 20 }, // Luas Pemakaman
                { wch: 15 }, // Total RTH
                { wch: 20 }, // Luas Kecamatan
                { wch: 18 }, // Persentase RTH
                { wch: 15 }  // Cluster
            ];
            worksheet['!cols'] = columnWidths;

            // Tambahkan worksheet ke workbook
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Data RTH Bandung');

            // Generate filename dengan timestamp UTC+7
            const now = new Date();
            const utcPlus7 = new Date(now.getTime() + (7 * 60 * 60 * 1000)); // Add 7 hours
            const timestamp = utcPlus7.toISOString().slice(0, 19).replace(/[:.]/g, '-');
            const filterInfo = selectedCluster !== 'all' || searchTerm ? '_filtered' : '';
            const filename = `Data_RTH_Bandung_${timestamp}_UTC+7${filterInfo}.xlsx`;

            // Download file
            XLSX.writeFile(workbook, filename);

            // Toast success dengan filename
            showToast.success(`File berhasil didownload: ${filename.substring(0, 30)}...`);

        } catch (error) {
            console.error('Error downloading Excel:', error);
            showToast.error('Gagal mendownload data. Silakan coba lagi.');
        } finally {
            setDownloadLoading(false);
        }
    };

    // Fungsi untuk mengganti pengurutan
    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    // Fungsi untuk mendapatkan arah pengurutan saat ini
    const getSortDirection = (key) => {
        if (sortConfig.key !== key) return '';
        return sortConfig.direction === 'ascending' ? ' ↑' : ' ↓';
    };

    // Helper function untuk menghitung total dengan safe handling
    const safeReduce = (array, field) => {
        if (!array || !Array.isArray(array)) return 0;
        return array.reduce((sum, item) => {
            const value = parseFloat(item[field]) || 0;
            return sum + value;
        }, 0);
    };

    // Hitung total dan rata-rata dari SEMUA data (untuk dashboard)
    const totalLuasTamanAll = safeReduce(kecamatanData, 'luas_taman');
    const totalLuasPemakamanAll = safeReduce(kecamatanData, 'luas_pemakaman');
    const totalRthAll = safeReduce(kecamatanData, 'total_rth');
    const totalLuasKecamatanAll = safeReduce(kecamatanData, 'luas_kecamatan');
    const persentaseRthAll = totalLuasKecamatanAll > 0 ? (totalRthAll / totalLuasKecamatanAll) * 100 : 0;

    // Hitung total dan rata-rata dari data yang SUDAH difilter (untuk tabel)
    const totalLuasTaman = safeReduce(filteredData, 'luas_taman');
    const totalLuasPemakaman = safeReduce(filteredData, 'luas_pemakaman');
    const totalRth = safeReduce(filteredData, 'total_rth');
    const totalLuasKecamatan = safeReduce(filteredData, 'luas_kecamatan');

    // Get unique clusters untuk dropdown filter
    const getUniqueClusters = () => {
        if (!kecamatanData || !Array.isArray(kecamatanData)) return ['all'];
        const uniqueClusters = [...new Set(kecamatanData.map(item => item.cluster))].filter(Boolean);
        return ['all', ...uniqueClusters];
    };

    const clusters = getUniqueClusters();

    // Fungsi untuk menentukan warna berdasarkan cluster
    const getClusterColor = (cluster) => {
        switch (cluster) {
            case 'cluster_0':
                return {
                    bg: 'bg-red-500',
                    bgLight: 'bg-red-100',
                    text: 'text-red-800'
                };
            case 'cluster_1':
                return {
                    bg: 'bg-yellow-500',
                    bgLight: 'bg-yellow-100',
                    text: 'text-yellow-800'
                };
            case 'cluster_2':
                return {
                    bg: 'bg-green-500',
                    bgLight: 'bg-green-100',
                    text: 'text-green-800'
                };
            default:
                return {
                    bg: 'bg-gray-500',
                    bgLight: 'bg-gray-100',
                    text: 'text-gray-800'
                };
        }
    };

    // Fungsi untuk mendapatkan kelas hover berdasarkan cluster
    const getHoverClass = (cluster) => {
        switch (cluster) {
            case 'cluster_0':
                return 'hover:bg-red-50 hover:shadow-md';
            case 'cluster_1':
                return 'hover:bg-yellow-50 hover:shadow-md';
            case 'cluster_2':
                return 'hover:bg-green-50 hover:shadow-md';
            default:
                return 'hover:bg-gray-50 hover:shadow-md';
        }
    };

    // Retry handler
    const handleRetry = () => {
        setError(null);
        fetchData();
    };

    // Loading state dengan skeleton
    if (loading) {
        return (
            <div className="container mx-auto px-4 py-6">
                {/* Stats skeleton */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <StatsCardSkeleton key={index} />
                    ))}
                </div>

                {/* Filter skeleton */}
                <div className="bg-white rounded-lg shadow-md p-4 mb-6">
                    <div className="grid md:grid-cols-3 gap-4">
                        {Array.from({ length: 3 }).map((_, index) => (
                            <div key={index} className="animate-pulse">
                                <div className="h-4 bg-gray-200 rounded w-20 mb-1"></div>
                                <div className="h-10 bg-gray-200 rounded w-full"></div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Table skeleton */}
                <div className="bg-white rounded-lg shadow-md overflow-hidden">
                    <div className="p-4 border-b">
                        <div className="h-6 bg-gray-200 rounded w-64 animate-pulse"></div>
                    </div>
                    <TableSkeleton rows={8} columns={7} />
                </div>
            </div>
        );
    }

    // Error state dengan retry
    if (error && (!kecamatanData || kecamatanData.length === 0)) {
        return (
            <div className="container mx-auto px-4 py-6">
                <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-6 max-w-md mx-auto">
                    <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
                        <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold mb-2 text-center">Gagal Memuat Data</h2>
                    <p className="mb-4 text-center">{error}</p>
                    <div className="flex space-x-2">
                        <button
                            className="flex-1 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
                            onClick={handleRetry}
                        >
                            Coba Lagi
                        </button>
                        <button
                            className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300 transition-colors"
                            onClick={() => window.location.href = '/peta'}
                        >
                            Lihat Peta
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-6">
            {/* Dashboard informasi - SELALU MENAMPILKAN DATA TOTAL */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow">
                    <h3 className="text-lg font-semibold mb-2 text-gray-700">Total RTH Publik</h3>
                    <p className="text-3xl font-bold text-green-600">{totalRthAll.toFixed(2)} ha</p>
                </div>

                <div className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow">
                    <h3 className="text-lg font-semibold mb-2 text-gray-700">Persentase RTH Publik</h3>
                    <p className="text-3xl font-bold text-blue-600">{persentaseRthAll.toFixed(2)}%</p>
                </div>

                <div className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow">
                    <h3 className="text-lg font-semibold mb-2 text-gray-700">Jumlah Kecamatan</h3>
                    <p className="text-3xl font-bold text-purple-600">{kecamatanData.length || 0}</p>
                </div>

                <div className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow">
                    <h3 className="text-lg font-semibold mb-2 text-gray-700">Target RTH Publik</h3>
                    <div className="flex items-center justify-between">
                        <p className="text-3xl font-bold text-red-600">20%</p>
                        <div className="text-sm text-gray-500">
                            {persentaseRthAll < 20 ?
                                <span className="text-red-500">Belum tercapai</span> :
                                <span className="text-green-500">Tercapai</span>
                            }
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter dan Pencarian */}
            <div className="bg-white rounded-lg shadow-md p-4 mb-6">
                <div className="grid md:grid-cols-3 gap-4">
                    {/* Search */}
                    <div>
                        <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
                            Cari Kecamatan
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                            <input
                                type="text"
                                id="search"
                                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                                placeholder="Ketik nama kecamatan..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Filter Cluster */}
                    <div>
                        <label htmlFor="cluster-filter" className="block text-sm font-medium text-gray-700 mb-1">
                            Filter Berdasarkan Cluster
                        </label>
                        <select
                            id="cluster-filter"
                            className="block w-full py-2 px-3 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                            value={selectedCluster}
                            onChange={(e) => setSelectedCluster(e.target.value)}
                        >
                            <option value="all">Semua Cluster</option>
                            {clusters.filter(c => c !== 'all').map((cluster) => (
                                <option key={cluster} value={cluster}>{cluster}</option>
                            ))}
                        </select>
                    </div>

                    {/* Download Button */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Download Data
                        </label>
                        <button
                            onClick={downloadToExcel}
                            disabled={downloadLoading || (!kecamatanData.length)}
                            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-md transition-colors flex items-center justify-center"
                        >
                            {downloadLoading ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Downloading...
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                    </svg>
                                    Download Excel
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Menampilkan status filter yang aktif */}
                {(selectedCluster !== 'all' || searchTerm) && (
                    <div className="mt-4 p-2 bg-blue-50 rounded text-sm text-blue-700">
                        <div className="flex flex-wrap gap-2 items-center">
                            <span className="font-medium">Filter aktif:</span>
                            {selectedCluster !== 'all' && (
                                <span className="bg-blue-100 px-2 py-1 rounded-full">
                                    Cluster: {selectedCluster}
                                    <button
                                        className="ml-1 text-blue-500 hover:text-blue-700"
                                        onClick={() => setSelectedCluster('all')}
                                    >
                                        ×
                                    </button>
                                </span>
                            )}
                            {searchTerm && (
                                <span className="bg-blue-100 px-2 py-1 rounded-full">
                                    Kecamatan: "{searchTerm}"
                                    <button
                                        className="ml-1 text-blue-500 hover:text-blue-700"
                                        onClick={() => setSearchTerm('')}
                                    >
                                        ×
                                    </button>
                                </span>
                            )}
                            <button
                                className="text-blue-700 hover:text-blue-900 underline ml-auto"
                                onClick={() => {
                                    setSelectedCluster('all');
                                    setSearchTerm('');
                                }}
                            >
                                Reset Semua Filter
                            </button>
                            <span className="text-blue-600 text-xs">
                                Download akan menggunakan data yang sedang ditampilkan ({filteredData.length} item)
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Tabel data RTH */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
                <div className="p-4 border-b">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-xl font-semibold">Data Ruang Terbuka Hijau Publik Kota Bandung</h2>
                            <p className="text-sm text-gray-600 mt-1">
                                Data luas taman, pemakaman dan ruang terbuka hijau di setiap kecamatan
                                {filteredData.length !== kecamatanData.length && kecamatanData.length > 0 &&
                                    ` (Menampilkan ${filteredData.length} dari ${kecamatanData.length} kecamatan)`}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No</th>
                                <th
                                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                                    onClick={() => requestSort('kecamatan')}
                                >
                                    Kecamatan {getSortDirection('kecamatan')}
                                </th>
                                <th
                                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                                    onClick={() => requestSort('luas_taman')}
                                >
                                    Luas Taman (ha) {getSortDirection('luas_taman')}
                                </th>
                                <th
                                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                                    onClick={() => requestSort('luas_pemakaman')}
                                >
                                    Luas Pemakaman (ha) {getSortDirection('luas_pemakaman')}
                                </th>
                                <th
                                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                                    onClick={() => requestSort('total_rth')}
                                >
                                    Total RTH (ha) {getSortDirection('total_rth')}
                                </th>
                                <th
                                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                                    onClick={() => requestSort('luas_kecamatan')}
                                >
                                    Luas Kecamatan (ha) {getSortDirection('luas_kecamatan')}
                                </th>
                                <th
                                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                                    onClick={() => requestSort('cluster')}
                                >
                                    Cluster {getSortDirection('cluster')}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredData.length > 0 ?
                                filteredData.map((data, index) => {
                                    const clusterColor = getClusterColor(data.cluster);
                                    const hoverClass = getHoverClass(data.cluster);

                                    return (
                                        <tr
                                            key={data.id || index}
                                            className={`
                                                transition-all duration-200 cursor-pointer
                                                ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                                                ${hoverClass}
                                            `}
                                        >
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{index + 1}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{data.kecamatan}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                {typeof data.luas_taman === 'number' ? data.luas_taman.toFixed(3) : '0.000'}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                {typeof data.luas_pemakaman === 'number' ? data.luas_pemakaman.toFixed(3) : '0.000'}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                {typeof data.total_rth === 'number' ? data.total_rth.toFixed(3) : '0.000'}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                {typeof data.luas_kecamatan === 'number' ? data.luas_kecamatan.toFixed(0) : '0'}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                <span className={`px-2 py-1 rounded-full text-xs ${clusterColor.bgLight} ${clusterColor.text}`}>
                                                    {data.cluster || 'undefined'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                                :
                                <tr>
                                    <td colSpan="7" className="px-4 py-8 text-center text-sm text-gray-500">
                                        <div className="flex flex-col items-center">
                                            <svg className="h-8 w-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <p>Tidak ada data yang sesuai dengan filter</p>
                                            <button
                                                className="mt-2 text-blue-600 hover:text-blue-800 underline"
                                                onClick={() => {
                                                    setSelectedCluster('all');
                                                    setSearchTerm('');
                                                }}
                                            >
                                                Reset filter
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            }
                        </tbody>
                        <tfoot className="bg-gray-50">
                            <tr>
                                <td className="px-4 py-3 text-sm font-medium text-gray-900" colSpan="2">Total</td>
                                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                    {totalLuasTaman.toFixed(3)}
                                </td>
                                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                    {totalLuasPemakaman.toFixed(3)}
                                </td>
                                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                    {totalRth.toFixed(3)}
                                </td>
                                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                    {totalLuasKecamatan.toFixed(0)}
                                </td>
                                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                    -
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* Download Information Section */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start">
                    <svg className="h-5 w-5 text-blue-600 mr-3 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                        <h3 className="text-lg font-semibold text-blue-800 mb-2">Informasi Download Excel</h3>
                        <div className="text-sm text-blue-700 space-y-1">
                            <p>• File Excel akan berisi semua data yang ditampilkan di tabel saat ini</p>
                            <p>• Jika Anda menggunakan filter, hanya data yang sesuai filter yang akan didownload</p>
                            <p>• File akan mencakup: No, Kecamatan, Luas Taman, Luas Pemakaman, Total RTH, Luas Kecamatan, Persentase RTH, dan Cluster</p>
                            <p>• Baris total akan ditambahkan secara otomatis di akhir file</p>
                            <p>• Nama file akan mencakup timestamp untuk menghindari duplikasi</p>
                            <p>• Format file: <code className="bg-blue-100 px-1 rounded">Data_RTH_Bandung_2025-05-26T17-30-00_filtered.xlsx</code> (UTC+7)</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Informasi tambahan */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg shadow-md p-4">
                    <h2 className="text-lg font-semibold mb-4">Distribusi RTH per Cluster</h2>
                    <div className="space-y-4">
                        {/* Cluster distribution - hanya tampilkan jika ada data */}
                        {clusters.filter(c => c !== 'all').length > 0 ?
                            clusters.filter(c => c !== 'all').map((cluster, index) => {
                                const clusterColor = getClusterColor(cluster);
                                const count = kecamatanData.filter(item => item.cluster === cluster).length;

                                return (
                                    <div key={index} className="flex items-center">
                                        <div className={`w-3 h-3 rounded-full mr-2 ${clusterColor.bg}`}></div>
                                        <div className="flex-1">
                                            <div className="flex justify-between mb-1">
                                                <span className="text-sm font-medium text-gray-700">{cluster}</span>
                                                <span className="text-sm font-medium text-gray-700">{count} kecamatan</span>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-2">
                                                <div className={`h-2 rounded-full ${clusterColor.bg}`}
                                                    style={{ width: `${(count / (kecamatanData.length || 1)) * 100}%` }}>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                            :
                            <div className="text-gray-500 text-center py-4">
                                Tidak ada data cluster tersedia
                            </div>
                        }
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow-md p-4">
                    <h2 className="text-lg font-semibold mb-4">Informasi Ruang Terbuka Hijau</h2>
                    <p className="text-gray-700 mb-4">
                        Total luas RTH Publik di Kota Bandung saat ini adalah {persentaseRthAll.toFixed(2)}% dari luas wilayah kota.
                        Target yang ditetapkan dalam rencana tata ruang kota adalah 20% sesuai dengan standar nasional.
                    </p>

                    <div className="bg-green-50 p-3 rounded-lg mb-4">
                        <h3 className="text-md font-semibold text-green-700 mb-2">Komposisi RTH</h3>
                        <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-600">Taman</span>
                            <span className="text-gray-800 font-medium">
                                {totalLuasTamanAll.toFixed(2)} ha
                                ({(totalRthAll > 0 ? (totalLuasTamanAll / totalRthAll * 100) : 0).toFixed(1)}%)
                            </span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Pemakaman</span>
                            <span className="text-gray-800 font-medium">
                                {totalLuasPemakamanAll.toFixed(2)} ha
                                ({(totalRthAll > 0 ? (totalLuasPemakamanAll / totalRthAll * 100) : 0).toFixed(1)}%)
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Download Status Info */}
            {downloadLoading && (
                <div className="fixed bottom-4 right-4 bg-white border border-gray-300 rounded-lg shadow-lg p-4 z-50">
                    <div className="flex items-center">
                        <svg className="animate-spin h-5 w-5 text-green-600 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <div>
                            <p className="font-medium text-gray-800">Sedang memproses download...</p>
                            <p className="text-sm text-gray-600">Mohon tunggu sebentar</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DataPage;