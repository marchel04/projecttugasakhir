"use client";

import {
  Button,
  Flex,
  Form,
  Input,
  message,
  Modal,
  DatePicker,
  Descriptions,
  Skeleton,
  Upload,
} from "antd";
import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { UploadOutlined } from "@ant-design/icons";

const { RangePicker } = DatePicker;

const normFile = (e) => {
  console.log("Upload event:", e);
  if (Array.isArray(e)) {
    return e;
  }
  return e?.fileList;
};

const BerandaClient = () => {
  const [role, setRole] = useState(null);
  const [pegawai, setPegawai] = useState(null);
  const [absen, setAbsen] = useState(null);
  const [izinHariIni, setIzinHariIni] = useState(null);
  const [nip, setNip] = useState("");
  const [loading, setLoading] = useState(true);
  const [btnLoading, setBtnLoading] = useState(false);
  const [form] = Form.useForm();
  const [isModalIzinOpen, setIsModalIzinOpen] = useState(false);


  // useeffect me
  useEffect(() => {
    let isMounted = true;

    const fetchMe = async () => {
      try {
        const meRes = await fetch("/api/auth/me");
        const meJson = await meRes.json();

        if (!meJson.success || !isMounted) return;

        setRole(meJson.data.role);
        setNip(meJson.data.nip);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchMe();

    return () => {
      isMounted = false;
    };
  }, []);

  // useeffect pegawai
  useEffect(() => {
    if (!nip) return;

    const fetchPegawai = async () => {
      const res = await fetch(`/api/pegawai/${nip}`);
      const data = await res.json();

      if (data.success) {
        setPegawai(data.data);
      }
    };

    fetchPegawai();
  }, [nip]);

  // useeffect absensi pegawai
  const fetchAbsenToday = async () => {
    try {
      const res = await fetch("/api/absensi/today");
      const data = await res.json();

      if (!data.success) {
        setAbsen(null);
        return;
      }

      setAbsen(data.data);
    } catch (err) {
      console.error("Gagal fetch absensi:", err);
    }
  };

  // useeffect izin pegawai hari ini
  const fetchIzinHariIni = async () => {
    try {
      const res = await fetch("/api/izin/today");
      const data = await res.json();

      if (data.success && data.data) {
        setIzinHariIni(data.data);
      } else {
        setIzinHariIni(null);
      }
    } catch (err) {
      console.error("Gagal fetch izin hari ini:", err);
      setIzinHariIni(null);
    }
  };

  useEffect(() => {
    if (!role) return;
    fetchAbsenToday();
    fetchIzinHariIni();
  }, [role]);

  useEffect(() => {
    // jam kerja diambil dari pengaturan pegawai di backend; tidak perlu mengambil pilihan di frontend
  }, []);

  const handleAbsenMasuk = async (values) => {
    // Check if pegawai has any leave (pending atau disetujui) for today
    if (izinHariIni) {
      message.error("Anda tidak bisa absen karena sudah membuat izin untuk hari ini");
      return;
    }

    setBtnLoading(true);

    try {
      // tidak mengirimkan id_jam — backend akan menggunakan jam yang terasosiasi dengan pegawai
      const payload = {
        tgl_absensi: new Date().toISOString(),
        jam_masuk: new Date().toISOString(),
        status: "hadir",
      };

      console.log("Absen masuk payload:", payload);

      const res = await fetch("/api/absensi", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.message || "Gagal absen masuk");
      }

      console.log("Absen masuk sukses:", json);
      message.success("Absen masuk berhasil");
      await fetchAbsenToday();
      form.resetFields();
    } catch (err) {
      console.error(err.message);
      message.error(err.message);
    } finally {
      setBtnLoading(false);
    }
  };

  const handleIzin = async (values) => {
    setBtnLoading(true);

    try {
      const [tglMulai, tglSelesai] = values.tgl_izin;

      const formData = new FormData();
      formData.append("alasan", values.alasan);
      formData.append("tgl_mulai", tglMulai.toISOString());
      formData.append("tgl_selesai", tglSelesai.toISOString());
      formData.append("file", values.upload[0].originFileObj);

      const res = await fetch("/api/izin", {
        method: "POST",
        body: formData, // ⬅️ multipart
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      message.success("Izin berhasil");
      setIsModalIzinOpen(false);
      form.resetFields();
    } catch (err) {
      message.error(err.message);
    } finally {
      setBtnLoading(false);
    }
  };

  const handleAbsenPulang = async () => {
    // Check if pegawai has any leave (pending atau disetujui) for today
    if (izinHariIni) {
      message.error("Anda tidak bisa absen pulang karena sudah membuat izin untuk hari ini");
      return;
    }

    setBtnLoading(true);

    try {
      const res = await fetch("/api/absensi/pulang", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jam_pulang: new Date().toISOString(),
          status: "hadir",
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        message.error(json.error?.message || json.message || "Gagal absen pulang");
        return;
      }

      console.log("Absen pulang sukses:", json);
      message.success("Berhasil absen pulang");
      await fetchAbsenToday();
    } catch (err) {
      console.error(err.message);
      message.error(err.message || "Terjadi kesalahan saat absen pulang");
    } finally {
      setBtnLoading(false);
    }
  };

  const showModalAdd = () => {
    // langsung lakukan absen tanpa meminta pemilihan jam kerja
    handleAbsenMasuk();
  };

  const showModalIzin = () => {
    form.resetFields();
    setIsModalIzinOpen(true);
  };

  const items = [
    {
      label: "Nama Pegawai",
      children: pegawai?.nama_lengkap || "N/A",
    },
    {
      label: "NIP",
      children: pegawai?.nip || "N/A",
    },
    {
      label: "Jenis Kelamin",
      children: pegawai?.jenis_kelamin || "N/A",
    },
    {
      label: "Jabatan",
      children: pegawai?.jabatan || "N/A",
    },
    {
      label: "Divisi",
      children: pegawai?.divisi?.nama_divisi || "N/A",
    },
    {
      label: "No Telepon",
      children: pegawai?.no_telepon || "N/A",
    },
  ];

  const itemsAbsen = [
    {
      label: "Absen Masuk",
      children: absen?.jam_masuk
        ? dayjs(absen?.jam_masuk).format("YYYY-MM-DD HH:mm:ss")
        : "Belum absen masuk",
    },
    {
      label: "Jam Terlambat",
      children: (() => {
        if (!absen?.jam_masuk) return "-";
        const terlambat = absen?.jam_terlambat || 0;
        if (terlambat > 0) {
          return `${terlambat} menit`;
        }
        return "Tepat waktu";
      })(),
    },
    {
      label: "Absen Pulang",
      children: (() => {
        if (absen?.jam_pulang) return dayjs(absen.jam_pulang).format("YYYY-MM-DD HH:mm:ss");
        // jika belum absen pulang, dan ada jamKerja.batas_pulang, cek apakah waktu sekarang sudah melewati batas
        const batasStr = absen?.jamKerja?.batas_pulang || absen?.jamKerja?.jam_pulang;
        if (batasStr) {
          const tanggal = absen?.tgl_absensi ? dayjs(absen.tgl_absensi).format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD");
          // Parse batas pulang without relying on dayjs timezone plugin in the frontend
          const batas = dayjs(`${tanggal} ${batasStr}`, ["YYYY-MM-DD HH:mm", "YYYY-MM-DD HH:mm:ss"]);
          if (dayjs().isAfter(batas)) {
            return "Belum absen pulang";
          }
        }
        return "Belum absen pulang";
      })(),
    },
  ];

  return (
    <>
      {/* Jam kerja selection removed — pegawai cukup klik Absen Masuk */}

      <Modal
        title={"Input Izin"}
        open={isModalIzinOpen}
        onOk={() => form.submit()}
        onCancel={() => setIsModalIzinOpen(false)}
        centered
      >
        <Form form={form} layout="vertical" onFinish={handleIzin}>
          <Form.Item
            name="alasan"
            label="Alasan"
            rules={[{ required: true, message: "Alasan wajib diisi" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="upload"
            label="Upload Bukti Dokumen"
            valuePropName="fileList"
            getValueFromEvent={normFile}
            rules={[{ required: true, message: "Dokumen wajib diupload" }]}
          >
            <Upload
              beforeUpload={() => false} // ⬅️ PENTING
              maxCount={1}
              accept=".pdf,.jpg,.jpeg,.png"
            >
              <Button icon={<UploadOutlined />}>Upload Dokumen</Button>
            </Upload>
          </Form.Item>
          <Form.Item
            name="tgl_izin"
            label="Tanggal Izin"
            rules={[{ required: true, message: "Tanggal izin wajib diisi" }]}
          >
            <RangePicker
              disabledDate={(current) => {
                // Disable dates before today (local time)
                if (!current) return false;
                return current.isBefore(dayjs().startOf('day'));
              }}
            />
          </Form.Item>
        </Form>
      </Modal>

      <div className="">
        <Skeleton loading={loading} active paragraph={false} title={false}>
          <Descriptions
            title="Informasi Pengguna"
            bordered
            column={1}
            className="desc-user"
            items={items}
          />
        </Skeleton>

        {role === "pegawai" && (
          <div className="mt-5">
            <Skeleton loading={loading} active paragraph={false} title={false}>
              <Descriptions
                title="Absensi Hari Ini"
                bordered
                column={1}
                className="desc-user"
                items={itemsAbsen}
              />
            </Skeleton>
          </div>
        )}

        {role === "pegawai" && (
          <>
            {izinHariIni && (
              <div
                style={{
                  marginTop: 16,
                  padding: "12px",
                  backgroundColor: "#fff7e6",
                  border: "1px solid #ffc069",
                  borderRadius: "4px",
                  color: "#ad6800",
                }}
              >
                <strong>ℹ️ Informasi:</strong> Anda sudah membuat izin untuk hari ini. Anda tidak dapat melakukan absen masuk maupun absen pulang.
              </div>
            )}
            <Flex justify="center" align="center" direction="row" gap="middle">
              <Button
                loading={btnLoading}
                type="primary"
                style={{ marginTop: 16 }}
                onClick={showModalAdd}
                disabled={absen?.jam_masuk ? true : false || !!izinHariIni}
              >
                Absen Masuk
              </Button>

              <Button
                loading={btnLoading}
                type="primary"
                style={{ marginTop: 16 }}
                onClick={handleAbsenPulang}
                disabled={!absen?.jam_masuk || !!absen?.jam_pulang || !!izinHariIni}
              >
                Absen Pulang
              </Button>

              <Button
                loading={btnLoading}
                type="primary"
                style={{ marginTop: 16 }}
                onClick={showModalIzin}
              >
                Input Izin
              </Button>
            </Flex>
          </>
        )}
      </div>
    </>
  );
};

export default BerandaClient;
