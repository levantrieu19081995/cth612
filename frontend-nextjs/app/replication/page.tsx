"use client";
import { usePolling } from "../../lib/usePolling";
import type { ReplicationSnapshot } from "../../types/replication";
import type { AnalyticsSummary } from "../../types/monitoring";
import ReplicationTopology from "./ReplicationTopology";
import { Alert, Anchor, Badge, Box, Button, Center, Code, Divider, Group, List, Loader, Paper, SimpleGrid, Stack, Table, Text, ThemeIcon, Title } from "@mantine/core";
import { IconAlertCircle, IconChartBar, IconCheck, IconClock, IconDatabase, IconInfoCircle, IconNetwork, IconRefresh, IconServer, IconSitemap, IconTable, IconTicket } from "@tabler/icons-react";

const number = new Intl.NumberFormat("vi-VN");

// Every number on this page comes from /api/monitoring/replication, which reads CockroachDB ranges and
// Cassandra token ownership; explanatory sentences only describe those measured values.
export default function ReplicationPage() {
  const { data, error, loading, refresh } = usePolling<ReplicationSnapshot>("/api/monitoring/replication", 10000);
  // Event counts live in Cassandra and the outbox; the analytics summary already reads both.
  const { data: summary } = usePolling<AnalyticsSummary>("/api/analytics/summary", 10000);

  const cr = data?.cockroach, cs = data?.cassandra;

  const totalRows = cr?.tables.reduce((sum, t) => sum + t.rows, 0) ?? 0;

  const rowsOf = (table: string) => cr?.tables.find(t => t.table === table)?.rows ?? 0;

  const nodeName = (id: number) => cr?.nodes.find(n => n.nodeId === id)?.address.replace(/:\d+$/, "") ?? `node ${id} (không còn trong cụm)`;

  const copiesText = cr ? (cr.minCopies === cr.maxCopies ? `${cr.maxCopies}` : `${cr.minCopies}–${cr.maxCopies}`) : "—";
  return (
    <Box component="section" maw={1440} mx="auto" px={{ base: "md", md: "lg" }} py={{ base: "lg", md: "xl" }}>
      <Stack gap="lg">
        {/* HEADER */}
        <Group align="center" gap="md" wrap="wrap">
          <ThemeIcon size={54} radius="lg" color="indigo" variant="light">
            <IconSitemap size={27} stroke={1.7} />
          </ThemeIcon>
          <Box style={{ flex: 1, minWidth: 240 }}>
            <Text fw={800} fz={12} c="indigo.7" tt="uppercase" lts={1}>
              PHÂN TÁN DỮ LIỆU
            </Text>
            <Title order={1} fz={{ base: 24, sm: 30 }} fw={800} lh={1.25}>
              Dữ liệu nằm ở đâu, có bao nhiêu bản
            </Title>
            <Text c="dimmed" fz="sm" mt={5}>
              Đọc trực tiếp từ CockroachDB (range, bản sao) và Cassandra (token, replication factor).
            </Text>
          </Box>
          <Button
            color="indigo"
            variant="light"
            radius="md"
            size="md"
            leftSection={<IconRefresh size={18} />}
            loading={loading}
            onClick={refresh}
          >
            Làm mới
          </Button>
        </Group>

        {error && (
          <Alert color="red" variant="light" radius="lg" title="Mất kết nối backend" icon={<IconAlertCircle size={21} />} role="alert">
            {error}. Dữ liệu bên dưới là lần đọc trước.
          </Alert>
        )}

        {loading && !data && (
          <Paper withBorder radius="xl" p="xl">
            <Center mih={190} role="status">
              <Stack align="center" gap="sm">
                <Loader size="md" color="indigo" />
                <Text c="dimmed">Đang đọc vị trí dữ liệu…</Text>
              </Stack>
            </Center>
          </Paper>
        )}

        <ReplicationTopology data={data} stale={!!error || !data?.observedAt || !Number.isFinite(Date.parse(data.observedAt)) || Date.now() - Date.parse(data.observedAt) > 45000} />

        {data && cr && cs && (
          <Stack gap="lg">
            {/* THỐNG KÊ DỮ LIỆU */}
            {cr.status !== "UNAVAILABLE" && (
              <Paper withBorder radius="xl" p={{ base: "md", sm: "lg" }}>
                <Stack gap="md">
                  <Group gap="sm" wrap="nowrap">
                    <ThemeIcon color="blue" variant="light" size={42} radius="md">
                      <IconChartBar size={22} />
                    </ThemeIcon>
                    <Box>
                      <Text fz={12} fw={800} c="blue.7" tt="uppercase" lts={0.8}>TỔNG QUAN</Text>
                      <Title order={2} fz="xl">Lượng dữ liệu hiện có</Title>
                    </Box>
                  </Group>
                  <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                    <Paper withBorder p="lg" radius="lg" style={{ borderTop: "3px solid var(--mantine-color-blue-5)" }}>
                      <Stack gap="xs">
                        <Text fw={700} c="dark.6">Tổng số dòng CockroachDB</Text>
                        <Text fw={800} fz={32} lh={1.25} c="blue.7">{number.format(totalRows)}</Text>
                        <Text size="sm" c="dimmed" style={{ overflowWrap: "anywhere" }}>
                          {cr.tables.map(t => `${t.table}: ${number.format(t.rows)}`).join(" · ")}
                        </Text>
                      </Stack>
                    </Paper>
                    <Paper withBorder p="lg" radius="lg" style={{ borderTop: "3px solid var(--mantine-color-teal-5)" }}>
                      <Stack gap="xs">
                        <Text fw={700} c="dark.6">Vé đã đặt</Text>
                        <Text fw={800} fz={32} lh={1.25} c="teal.7">{number.format(rowsOf("bookings"))}</Text>
                        <Text size="sm" c="dimmed">
                          {number.format(rowsOf("payments"))} thanh toán · {number.format(rowsOf("flight_seats"))} ghế
                        </Text>
                      </Stack>
                    </Paper>
                    <Paper withBorder p="lg" radius="lg" style={{ borderTop: "3px solid var(--mantine-color-violet-5)" }}>
                      <Stack gap="xs">
                        <Text fw={700} c="dark.6">Sự kiện đã sang Cassandra</Text>
                        <Text fw={800} fz={32} lh={1.25} c="violet.7">
                          {summary ? number.format(summary.outbox.published) : "—"}
                        </Text>
                        <Text size="sm" c="dimmed">
                          {summary
                            ? `${number.format(summary.outbox.pending)} đang chờ · mỗi vé 4 sự kiện, ghi vào 2 bảng`
                            : "Đang đọc…"}
                        </Text>
                      </Stack>
                    </Paper>
                  </SimpleGrid>
                  <Alert color="gray" variant="light" radius="md" icon={<IconInfoCircle size={20} />}>
                    Số dòng đếm trực tiếp bằng <Code>SELECT count(*)</Code>. Cassandra lưu mỗi sự kiện hai lần
                    (theo vé và theo ngày), nên số dòng thực trong Cassandra gấp đôi số sự kiện.
                  </Alert>
                </Stack>
              </Paper>
            )}

            {/* BẢN SAO / QUORUM */}
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
              <Paper withBorder radius="xl" p="lg" style={{ borderTop: "4px solid var(--mantine-color-blue-5)" }}>
                <Stack gap="md" h="100%">
                  <Group gap="sm" wrap="nowrap">
                    <ThemeIcon color="blue" variant="light" radius="md" size={44}>
                      <IconDatabase size={23} />
                    </ThemeIcon>
                    <Box>
                      <Title order={2} fz="xl">CockroachDB</Title>
                      <Text c="dimmed" fz="sm">Phân vùng theo range và bản sao</Text>
                    </Box>
                  </Group>
                  {cr.status === "UNAVAILABLE" ? (
                    <Alert title="Không đọc được thông tin range" color="red" radius="md" icon={<IconAlertCircle size={20} />}>
                      {cr.error}
                    </Alert>
                  ) : (
                    <>
                      <Box>
                        <Group align="baseline" gap="xs">
                          <Text fw={850} fz={36} c="blue.7" lh={1.1}>{copiesText}</Text>
                          <Text fz={23} c="dimmed" fw={650}>/ {cr.targetReplicas ?? "?"}</Text>
                        </Group>
                        <Text c="dimmed" fz="sm" mt={4}>Bản sao mỗi range (thực tế / cấu hình)</Text>
                      </Box>
                      <Group gap="xs" wrap="wrap">
                        <Badge color="blue" variant="light" size="lg">{number.format(cr.ranges)} range</Badge>
                        <Badge color="gray" variant="light" size="lg">{cr.liveNodes}/{cr.knownNodes} node sống</Badge>
                      </Group>
                      <Alert
                        title={cr.rangesWithoutMajority ? "Một số range mất quorum" : "Đủ đa số bản sao"}
                        color={cr.rangesWithoutMajority ? "red" : "teal"}
                        variant="light"
                        radius="md"
                        icon={cr.rangesWithoutMajority ? <IconAlertCircle size={20} /> : <IconCheck size={20} />}
                      >
                        {cr.rangesWithoutMajority
                          ? `${cr.rangesWithoutMajority} range mất đa số bản sao → phần dữ liệu đó không đọc/ghi được cho tới khi node quay lại.`
                          : "Mọi range còn đa số bản sao đang sống → đọc/ghi được."}
                      </Alert>
                      {cr.targetReplicas != null && cr.maxCopies < cr.targetReplicas && (
                        <Alert color="orange" variant="light" radius="md" icon={<IconInfoCircle size={20} />}>
                          {cr.knownNodes < cr.targetReplicas
                            ? `Cụm mới có ${cr.knownNodes} node nên chưa đủ chỗ cho ${cr.targetReplicas} bản sao. CockroachDB chỉ giữ số bản sao lẻ (2 bản kém an toàn hơn 1 bản), nên mỗi range đang có ${cr.maxCopies} bản. Cần từ ${cr.targetReplicas} node để có ${cr.targetReplicas} bản sao.`
                            : `Cụm đã đủ node; CockroachDB đang tạo thêm bản sao cho tới ${cr.targetReplicas} bản mỗi range.`}
                        </Alert>
                      )}
                    </>
                  )}
                </Stack>
              </Paper>

              <Paper withBorder radius="xl" p="lg" style={{ borderTop: "4px solid var(--mantine-color-violet-5)" }}>
                <Stack gap="md" h="100%">
                  <Group gap="sm" wrap="nowrap">
                    <ThemeIcon color="violet" variant="light" radius="md" size={44}>
                      <IconServer size={23} />
                    </ThemeIcon>
                    <Box>
                      <Title order={2} fz="xl">Cassandra</Title>
                      <Text c="dimmed" fz="sm">Replication factor và consistency</Text>
                    </Box>
                  </Group>
                  {cs.status === "UNAVAILABLE" ? (
                    <Alert title="Không đọc được metadata Cassandra" color="red" radius="md" icon={<IconAlertCircle size={20} />}>
                      {cs.error}
                    </Alert>
                  ) : (
                    <>
                      <Box>
                        <Group align="baseline" gap="xs">
                          <Text fw={850} fz={36} c="violet.7" lh={1.1}>{cs.copiesPerRow ?? "—"}</Text>
                          <Text fz={23} c="dimmed" fw={650}>/ {cs.replicationFactor ?? "?"}</Text>
                        </Group>
                        <Text c="dimmed" fz="sm" mt={4}>Bản sao mỗi dòng sự kiện (thực tế / RF)</Text>
                      </Box>
                      <Group gap="xs" wrap="wrap">
                        <Badge color="violet" variant="light" size="lg">{cs.strategy}</Badge>
                        <Badge color="gray" variant="light" size="lg">{cs.liveNodes}/{cs.nodesInDatacenter} node UP</Badge>
                      </Group>
                      <Text fz="sm" c="dimmed">
                        Ghi ở mức <Text span fw={700} c="dark.7">{cs.consistency}</Text>,
                        cần <Text span fw={700} c="dark.7">{cs.requiredForWrite}</Text> bản sao xác nhận.
                      </Text>
                      <Alert
                        title={cs.writableWorstCase ? "Đủ bản sao để ghi" : "Nguy cơ không ghi được"}
                        color={cs.writableWorstCase ? "teal" : "red"}
                        variant="light"
                        radius="md"
                        icon={cs.writableWorstCase ? <IconCheck size={20} /> : <IconAlertCircle size={20} />}
                      >
                        {cs.writableWorstCase
                          ? `Kể cả dòng có bản sao trên node đang tắt vẫn còn ${cs.liveCopiesWorstCase} bản sống ≥ ${cs.requiredForWrite} → ghi được.`
                          : `Trường hợp xấu nhất chỉ còn ${cs.liveCopiesWorstCase} bản sống < ${cs.requiredForWrite} cần cho ${cs.consistency} → có dòng không ghi được; sự kiện chờ trong outbox và tự gửi lại khi node quay về.`}
                      </Alert>
                    </>
                  )}
                </Stack>
              </Paper>
            </SimpleGrid>

            {/* COCKROACH TABLES */}
            {cr.status !== "UNAVAILABLE" && (
              <Stack gap="lg">
                <Paper withBorder radius="xl" p={{ base: "md", sm: "lg" }}>
                  <Stack gap="md">
                    <Group gap="sm" wrap="nowrap">
                      <ThemeIcon color="blue" variant="light" radius="md" size={42}><IconServer size={22} /></ThemeIcon>
                      <Box style={{ minWidth: 0 }}>
                        <Title order={2} fz="xl">CockroachDB — mỗi node giữ gì</Title>
                        <Text c="dimmed" fz="sm">
                          Leaseholder: node đang phục vụ đọc/ghi cho range; bản sao: node giữ một bản dữ liệu của range.
                        </Text>
                      </Box>
                    </Group>
                    <Table.ScrollContainer minWidth={770}>
                      <Table striped highlightOnHover verticalSpacing="md" horizontalSpacing="md" withRowBorders>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Node</Table.Th>
                            <Table.Th>Địa chỉ</Table.Th>
                            <Table.Th>Trạng thái</Table.Th>
                            <Table.Th>Range phục vụ</Table.Th>
                            <Table.Th>Range giữ bản sao</Table.Th>
                            <Table.Th>Dung lượng bản sao</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {cr.nodes.map(n => (
                            <Table.Tr key={n.nodeId}>
                              <Table.Td><Text fw={750}>#{n.nodeId}</Text></Table.Td>
                              <Table.Td><Text fz="sm" style={{ overflowWrap: "anywhere" }}>{n.address}</Text></Table.Td>
                              <Table.Td>
                                <Badge color={n.live ? "teal" : "red"} variant="light" size="lg">
                                  {n.live ? "Đang sống" : "Mất kết nối"}
                                </Badge>
                              </Table.Td>
                              <Table.Td><Text fw={700}>{number.format(n.leaseholderRanges)}</Text></Table.Td>
                              <Table.Td><Text fw={650}>{number.format(n.replicaRanges)} / {number.format(cr.ranges)}</Text></Table.Td>
                              <Table.Td><Text fw={650}>{n.sizeMb.toFixed(2)} MB</Text></Table.Td>
                            </Table.Tr>
                          ))}
                          {!cr.nodes.length && (
                            <Table.Tr><Table.Td colSpan={6}><Text ta="center" c="dimmed" py="lg">Chưa có thông tin node.</Text></Table.Td></Table.Tr>
                          )}
                        </Table.Tbody>
                      </Table>
                    </Table.ScrollContainer>
                    <Text fz="sm" c="dimmed">
                      Dung lượng = kích thước logic của các range mà node giữ một bản; mỗi range tính một lần.
                      Tổng các node lớn hơn dữ liệu gốc khi có nhiều bản sao.
                    </Text>
                  </Stack>
                </Paper>

                <Paper withBorder radius="xl" p={{ base: "md", sm: "lg" }}>
                  <Stack gap="md">
                    <Group gap="sm" wrap="nowrap">
                      <ThemeIcon color="cyan" variant="light" radius="md" size={42}><IconTable size={22} /></ThemeIcon>
                      <Box>
                        <Title order={2} fz="xl">CockroachDB — theo bảng</Title>
                        <Text fz="sm" c="dimmed">Số dòng, dung lượng và phân bố range</Text>
                      </Box>
                    </Group>
                    <Table.ScrollContainer minWidth={670}>
                      <Table striped highlightOnHover verticalSpacing="md" horizontalSpacing="md">
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Bảng</Table.Th>
                            <Table.Th>Số dòng</Table.Th>
                            <Table.Th>Số range</Table.Th>
                            <Table.Th>Dung lượng</Table.Th>
                            <Table.Th>Số bản sao</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {cr.tables.map(t => (
                            <Table.Tr key={t.table}>
                              <Table.Td><Text fw={700}>{t.table}</Text></Table.Td>
                              <Table.Td>{number.format(t.rows)}</Table.Td>
                              <Table.Td>{number.format(t.ranges)}</Table.Td>
                              <Table.Td>{t.sizeMb.toFixed(3)} MB</Table.Td>
                              <Table.Td>
                                <Text fz="sm">{Object.entries(t.rangesByCopies).map(([copies, count]) => `${count} range × ${copies} bản`).join(", ") || "—"}</Text>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                          {!cr.tables.length && (
                            <Table.Tr><Table.Td colSpan={5}><Text ta="center" c="dimmed" py="lg">Chưa có thông tin bảng.</Text></Table.Td></Table.Tr>
                          )}
                        </Table.Tbody>
                      </Table>
                    </Table.ScrollContainer>
                    <Alert color="blue" variant="light" radius="md" icon={<IconInfoCircle size={20} />}>
                      Bảng nhỏ (vài MB) nằm gọn trong một range; CockroachDB chỉ tự chia khi range vượt 512 MB.
                      Dùng <Code>split-ranges.mjs</Code> trên PC1 để chia và rải lên các node.
                    </Alert>
                  </Stack>
                </Paper>
              </Stack>
            )}

            {/* CASSANDRA NODES */}
            {cs.status !== "UNAVAILABLE" && (
              <Paper withBorder radius="xl" p={{ base: "md", sm: "lg" }}>
                <Stack gap="md">
                  <Group gap="sm" wrap="nowrap">
                    <ThemeIcon color="violet" variant="light" radius="md" size={42}><IconNetwork size={22} /></ThemeIcon>
                    <Box>
                      <Title order={2} fz="xl">Cassandra — các node trong cụm</Title>
                      <Text fz="sm" c="dimmed">Datacenter và trạng thái kết nối</Text>
                    </Box>
                  </Group>
                  <Table.ScrollContainer minWidth={480}>
                    <Table striped highlightOnHover verticalSpacing="md" horizontalSpacing="md">
                      <Table.Thead><Table.Tr><Table.Th>Địa chỉ</Table.Th><Table.Th>Datacenter</Table.Th><Table.Th>Trạng thái</Table.Th></Table.Tr></Table.Thead>
                      <Table.Tbody>
                        {cs.nodes.map(n => (
                          <Table.Tr key={n.address}>
                            <Table.Td><Text fw={650}>{n.address}</Text></Table.Td>
                            <Table.Td>{n.datacenter}</Table.Td>
                            <Table.Td><Badge color={n.state === "UP" ? "teal" : "red"} variant="light" size="lg">{n.state}</Badge></Table.Td>
                          </Table.Tr>
                        ))}
                        {!cs.nodes.length && (
                          <Table.Tr><Table.Td colSpan={3}><Text ta="center" c="dimmed" py="lg">Chưa có thông tin node.</Text></Table.Td></Table.Tr>
                        )}
                      </Table.Tbody>
                    </Table>
                  </Table.ScrollContainer>
                </Stack>
              </Paper>
            )}

            {/* BOOKING SAMPLE PLACEMENT */}
            <Paper withBorder radius="xl" p={{ base: "md", sm: "lg" }}>
              <Stack gap="md">
                <Group gap="sm" wrap="nowrap">
                  <ThemeIcon color="teal" variant="light" radius="md" size={42}><IconTicket size={22} /></ThemeIcon>
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <Title order={2} fz="xl">5 vé mới nhất đang nằm ở đâu</Title>
                    <Text fz="sm" c="dimmed">Đối chiếu bản ghi booking và lịch sử sự kiện</Text>
                  </Box>
                  <Badge color="gray" variant="light" size="lg">{data.samples.length} vé</Badge>
                </Group>
                {!data.samples.length ? (
                  <Center py="xl"><Text c="dimmed">Chưa có vé hoặc CockroachDB chưa đọc được.</Text></Center>
                ) : (
                  <Table.ScrollContainer minWidth={760}>
                    <Table striped highlightOnHover verticalSpacing="md" horizontalSpacing="md">
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Mã vé</Table.Th>
                          <Table.Th>CockroachDB (dòng booking)</Table.Th>
                          <Table.Th>Cassandra (lịch sử sự kiện)</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {data.samples.map(s => (
                          <Table.Tr key={s.bookingId}>
                            <Table.Td>
                              <Anchor href={`/bookings/${s.bookingId}`} fw={750} c="blue.7" underline="hover">
                                {s.bookingCode}
                              </Anchor>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm" style={{ overflowWrap: "anywhere" }}>
                                {s.rangeId === null
                                  ? "—"
                                  : `Range #${s.rangeId}: ${s.cockroachReplicas.map(id => nodeName(id) + (id === s.leaseHolder ? " (phục vụ)" : "")).join(", ")}`}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm" style={{ overflowWrap: "anywhere" }}>
                                {s.cassandraReplicas.length ? s.cassandraReplicas.join(", ") : "—"}
                              </Text>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Table.ScrollContainer>
                )}
              </Stack>
            </Paper>

            {/* EXPLANATION */}
            <Paper radius="xl" p={{ base: "md", sm: "lg" }} withBorder bg="gray.0">
              <Stack gap="md">
                <Group gap="sm" wrap="nowrap">
                  <ThemeIcon color="orange" variant="light" radius="md" size={42}><IconInfoCircle size={22} /></ThemeIcon>
                  <Box>
                    <Title order={2} fz="xl">Cách đọc trang này</Title>
                    <Text c="dimmed" fz="sm">Ý nghĩa của bản sao và khả năng chịu lỗi</Text>
                  </Box>
                </Group>
                <List spacing="sm" size="sm" withPadding>
                  <List.Item>
                    Một range CockroachDB chỉ đọc/ghi được khi <Text span fw={700}>đa số</Text> bản sao còn sống (3 bản → cần 2).
                  </List.Item>
                  <List.Item>
                    Với 3 bản sao trên 4 máy, tắt 1 máy mỗi range vẫn còn ít nhất 2/3 → hệ thống tiếp tục đặt vé.
                  </List.Item>
                  <List.Item>
                    Cassandra ghi ở mức <Text span fw={700}>{cs.consistency ?? "LOCAL_QUORUM"}</Text>:
                    cần <Text span fw={700}>{cs.requiredForWrite ?? "đa số"}</Text> bản sao xác nhận.
                    Không đủ thì sự kiện nằm chờ trong outbox của CockroachDB, không bị mất.
                  </List.Item>
                </List>
                <Divider />
                <Group gap="xs">
                  <IconClock size={17} color="var(--mantine-color-gray-6)" />
                  <Text fz="sm" c="dimmed">
                    Quan sát lúc {new Date(data.observedAt).toLocaleString("vi-VN")}
                  </Text>
                </Group>
              </Stack>
            </Paper>
          </Stack>
        )}
      </Stack>
    </Box>

  );
}
